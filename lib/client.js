'use babel';

import FS from 'fs-plus';
import _fs from 'fs';
import http from 'http';
import https from 'https';
import { $ } from 'atom-space-pen-views';
import Path from 'path';
import { EventEmitter } from 'events';
import stripJsonComments from 'strip-json-comments';
import chokidar from 'chokidar';
import { multipleHostsEnabled, getObject } from './helpers';
import Directory from './directory';
import Progress from './progress';
import FTP from './connectors/ftp';
import SFTP from './connectors/sftp';
import PromptPassDialog from './dialogs/prompt-pass-dialog';
import Ignore from 'ignore';
import homedir from 'os-homedir';
import rimraf from 'rimraf';
import series from 'async/series';
import { Notification } from 'atom';

const atom = global.atom;

export default (function INIT() {
  class Client extends EventEmitter {
    constructor() {
      super();
      const self = this;
      self.info = null;
      self.connector = null;
      self.reconnectPopup = null;
      self._current = null;
      self._queue = [];

      self.root = new Directory({
        name: '/',
        path: '/',
        client: this,
        isExpanded: true,
      });

      self.status = 'NOT_CONNECTED'; // Options NOT_CONNECTED, CONNECTING, CONNECTED

      self.watch = {
        watcher: null,
        files: [],
        addListeners() {
          let watchData = getObject({
            keys: ['info', 'watch'],
            obj: self,
          });
          if (watchData === null || watchData === false) return;
          if (typeof watchData === 'string') watchData = [watchData];

          if (!Array.isArray(watchData) || watchData.length === 0) return;

          const dir = self.getProjectPath();

          const watchDataFormatted = watchData.map(watch => Path.resolve(dir, watch));

          const watcher = chokidar.watch(watchDataFormatted, {
            ignored: /[\/\\]\./,
            persistent: true,
          });

          watcher
          .on('change', (path) => {
            self.watch.queueUpload.apply(self, [path]);
          });

          self.files = watchDataFormatted.slice();

          // atom.notifications.addInfo('Commit Live IDE: Added watch listeners', {
          //   dismissable: false,
          // });
          self.watcher = watcher;
        },
        removeListeners() {
          if (self.watcher != null) {
            self.watcher.close();
            // atom.notifications.addInfo('Commit Live IDE: Stopped watch listeners', {
            //   dismissable: false,
            // });
          }
        },
        queue: {},
        queueUpload(fileName) {
          const timeoutDuration = isNaN(parseInt(self.info.watchTimeout, 10)) === true
            ? 500
            : parseInt(self.info.watchTimeout, 10);


          function scheduleUpload(file) {
            self.watch.queue[file] = setTimeout(() => {
              self.upload(file, () => {});
            }, timeoutDuration);
          }

          if (self.watch.queue[fileName] !== null) {
            clearTimeout(self.watch.queue[fileName]);
            self.watch.queue[fileName] = null;
          }

          scheduleUpload(fileName);
        },

      };

      self.watch.addListeners = self.watch.addListeners.bind(self);
      self.watch.removeListeners = self.watch.removeListeners.bind(self);

      self.on('connected', self.watch.addListeners);
      self.on('disconnected', self.watch.removeListeners);
    }

    readConfig(callback) {
      const self = this;
      const error = (err) => {
        if (typeof callback === 'function') callback.apply(self, [err]);
      };
      self.info = null;

      const userInfoObj = JSON.parse(localStorage.getItem('commit-live:user-info'));
      let ftpConfig = userInfoObj.servers.ftp_config;
      ftpConfig.privatekey = this.getPemFilePath();
      ftpConfig.remote = ftpConfig.remote.replace('/gitint/', '/' + userInfoObj.userName + '/')
      // repoUrl = JSON.parse(localStorage.getItem('commit-live:last-opened-project')).repoUrl
      // ftpConfig.remote = ftpConfig.remote + repoUrl.replace('commit-live-students', '');
      const contents = JSON.stringify(ftpConfig, null, 4);
      const data = stripJsonComments(contents);
      let json = null;
      if (self.validateConfig(data)) {
        try {
          json = JSON.parse(data);

          self.info = json;
          self.root.name = '';
          self.root.path = `/${self.info.remote.replace(/^\/+/, '')}`;
        } catch (e) {
          atom.notifications.addError('Could not process `.ftpconfig`', {
            detail: e,
            dismissable: false,
          });
        }
      }
      if (json !== null && typeof callback === 'function') {
        callback.apply(self, [null, json]);
      }
    }

    getFilePath(relativePath) {
      const self = this;
      const projectPath = self.getProjectPath();
      if (projectPath === false) return false;
      return Path.resolve(projectPath, relativePath);
    }

    getProjectPath() {
      const self = this;
      let projectPath = null;

      if (multipleHostsEnabled() === true) {
        const $selectedDir = $('.tree-view .selected');
        const $currentProject = $selectedDir.hasClass('project-root') ? $selectedDir : $selectedDir.closest('.project-root');
        projectPath = $currentProject.find('.header span.name').data('path');
      } else {
        const firstDirectory = self.getDirectories()[0];
        if (firstDirectory != null) projectPath = firstDirectory.path;
      }

      if (projectPath != null) {
        self.projectPath = projectPath;
        return projectPath;
      }
      atom.notifications.addError('Commit Live IDE: Could not get project path', {
        dismissable: false, // Want user to report error so don't let them close it
        detail: `Please report this error if it occurs. Multiple Hosts is ${multipleHostsEnabled()}`,
      });
      return false;
    }

    getDirectories() {
      return [
        {
          'path': this.getLocalProjectPath()
        }
      ];
    }

    getPaths() {
      return [
        this.getLocalProjectPath()
      ];
    }

    getConfigPath() {
      const self = this;
      return self.getFilePath('./.ftpconfig');
    }

    getPackageFilePath(relativePath) {
      const projectPath = Path.join(homedir(), '/.atom/.commit-live/');
      if (!FS.existsSync(projectPath)){
          FS.mkdirSync(projectPath);
      }
      return Path.resolve(projectPath, relativePath);
    }

    getPemFilePath() {
      return this.getPackageFilePath('./student.pem');
    }

    getLocalProjectPath() {
      return this.getPackageFilePath('./code');
    }

    validateConfig(data) {
      try {
        // try to parse the json
        JSON.parse(data);
        return true;
      } catch (error) {
        // try to extract bad syntax location from error message
        let lineNumber = -1;
        const regex = /at position ([0-9]+)$/;
        const result = error.message.match(regex);
        if (result && result.length > 0) {
          const cursorPos = parseInt(result[1]);
          // count lines until syntax error position
          const tmp = data.substr(0, cursorPos);
          for (lineNumber = -1, index = 0; index != -1; lineNumber++, index = tmp.indexOf('\n', index + 1));
        }

        // show notification
        atom.notifications.addError('Could not parse `.ftpconfig`', {
          detail: `${error.message}`,
          dismissable: false,
        });

        // open .ftpconfig file and mark the faulty line
        atom.workspace.open('.ftpconfig').then((editor) => {
          if (lineNumber == -1) return; // no line number to mark

          const decorationConfig = {
            class: 'ftpconfig_line_error',
          };
          editor.getDecorations(decorationConfig).forEach((decoration) => {
            decoration.destroy();
          });

          const range = editor.getBuffer().clipRange([[lineNumber, 0], [lineNumber, Infinity]]);
          const marker = editor.markBufferRange(range, {
            invalidate: 'inside',
          });

          decorationConfig.type = 'line';
          editor.decorateMarker(marker, decorationConfig);
        });
      }

      // return false, as the json is not valid
      return false;
    }

    isConnected() {
      const self = this;
      return self.connector && self.connector.isConnected();
    }

    onceConnected(onconnect) {
      const self = this;
      if (self.connector && self.connector.isConnected()) {
        onconnect.apply(self);
        return true;
      } else if (typeof onconnect === 'function') {
        if (self.status === 'NOT_CONNECTED') {
          self.status = 'CONNECTING';
          self.readConfig((err) => {
            if (err !== null) {
              self.status = 'NOT_CONNECTED';
              // NOTE: Remove notification as it will just say there
              // is no ftpconfig if none in directory all the time
              // atom.notifications.addError("Commit Live IDE: " + err);
              return;
            }
            self.connect(true);
          });
        }

        self.once('connected', onconnect);
        return false;
      }
      console.warn(`Commit Live IDE: Not connected and typeof onconnect is ${typeof onconnect}`);
      return false;
    }

    connect(reconnect, isReconnecting) {
      const self = this;
      if (reconnect !== true) self.disconnect();
      if (self.isConnected()) return;
      if (!self.info) return;
      if (self.info.promptForPass === true) self.promptForPass();
      else self.doConnect(isReconnecting);
    }

    doConnect(isReconnecting) {
      const self = this;

      let connectingMsg = "Commit Live IDE: Connecting...";
      if (isReconnecting) {
        connectingMsg = "Commit Live IDE: Trying again..."
      }
      let ftpConnectingPopup = new Notification("info", connectingMsg, {
        dismissable: true
      });
      atom.notifications.addNotification(ftpConnectingPopup);

      let info;
      switch (self.info.protocol) {
        case 'ftp': {
          info = {
            host: self.info.host || '',
            port: self.info.port || 21,
            user: self.info.user || '',
            password: self.info.pass || '',
            secure: self.info.secure || '',
            secureOptions: self.info.secureOptions || '',
            connTimeout: self.info.timeout || 10000,
            pasvTimeout: self.info.timeout || 10000,
            keepalive: self.info.keepalive || 10000,
            debug(str) {
              const log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
              if (!log) return;
              if (log[2].match(/^PASS /)) log[2] = 'PASS ******';
              self.emit('debug', `${log[1]} ${log[2]}`);
              console.debug(`${log[1]} ${log[2]}`);
            },
          };
          self.connector = new FTP(self);
          break;
        }

        case 'sftp': {
          info = {
            host: self.info.host || '',
            port: self.info.port || 21,
            username: self.info.user || '',
            readyTimeout: self.info.connTimeout || 10000,
            keepaliveInterval: self.info.keepalive || 10000,
          };

          if (self.info.pass) info.password = self.info.pass;

          if (self.info.privatekey) {
            try {
              const pk = _fs.readFileSync(self.info.privatekey);
              info.privateKey = pk;
            } catch (err) {
              setTimeout(function () {
                self.showReconnectPopup();
              }, 0);
            }
          }

          if (self.info.passphrase) info.passphrase = self.info.passphrase;

          if (self.info.agent) info.agent = self.info.agent;

          if (self.info.agent === 'env') info.agent = process.env.SSH_AUTH_SOCK;

          if (self.info.hosthash) info.hostHash = self.info.hosthash;

          if (self.info.ignorehost) {
            // NOTE: hostVerifier doesn't run at all if it's not a function.
            // Allows you to skip hostHash option in ssh2 0.5+
            info.hostVerifier = false;
          }

          info.algorithms = {
            key: [
              'ecdh-sha2-nistp256',
              'ecdh-sha2-nistp384',
              'ecdh-sha2-nistp521',
              'diffie-hellman-group-exchange-sha256',
              'diffie-hellman-group14-sha1',
              'diffie-hellman-group-exchange-sha1',
              'diffie-hellman-group1-sha1',
            ],
            cipher: [
              'aes128-ctr',
              'aes192-ctr',
              'aes256-ctr',
              'aes128-gcm',
              'aes128-gcm@openssh.com',
              'aes256-gcm',
              'aes256-gcm@openssh.com',
              'aes256-cbc',
              'aes192-cbc',
              'aes128-cbc',
              'blowfish-cbc',
              '3des-cbc',
              'arcfour256',
              'arcfour128',
              'cast128-cbc',
              'arcfour',
            ],
            serverHostKey: [
              'ssh-rsa',
              'ecdsa-sha2-nistp256',
              'ecdsa-sha2-nistp384',
              'ecdsa-sha2-nistp521',
              'ssh-dss',
            ],
            hmac: [
              'hmac-sha2-256',
              'hmac-sha2-512',
              'hmac-sha1',
              'hmac-md5',
              'hmac-sha2-256-96',
              'hmac-sha2-512-96',
              'hmac-ripemd160',
              'hmac-sha1-96',
              'hmac-md5-96',
            ],
            compress: [
              'none',
              'zlib@openssh.com',
              'zlib',
            ],
          };

          info.filePermissions = self.info.filePermissions;
          if (self.info.keyboardInteractive) info.tryKeyboard = true;

          self.connector = new SFTP(self);
          break;
        }

        default:
          throw new Error('No `protocol` found in connection credential. Please recreate .ftpconfig file from Packages -> GreyAtom Tree View -> Create (S)FTP config file.');
      }

      self.connector.connect(info, () => {
        ftpConnectingPopup.dismiss();
        if (self.root.status !== 1) self.root.open();
        self.emit('connected');
        self.status = 'CONNECTED';

        atom.notifications.addSuccess('Commit Live IDE: Connected', {
          dismissable: false,
        });
        if(atom.project.commitLiveIde && atom.project.commitLiveIde.activateIde) {
          atom.project.commitLiveIde.activateIde();
        }
      });

      self.connector.on('closed', (action) => {
        self.disconnect();
        self.status = 'NOT_CONNECTED';
        self.emit('closed');
        atom.notifications.addInfo('Commit Live IDE: Connection closed', {
          dismissable: false,
        });

        if (action === 'RECONNECT') {
          self.connect(true);
        }
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'commit-live-welcome:show-dashboard')
      });
      self.connector.on('ended', () => {
        self.emit('ended');
      });
      self.connector.on('error', (err) => {
        if (ftpConnectingPopup) {
          ftpConnectingPopup.dismiss();
        }
        atom.notifications.addError('Commit Live IDE: Connection failed', {
          detail: err,
          dismissable: false,
        });
      });
    }

    disconnect() {
      const self = this;

      if (self.connector) {
        self.connector.disconnect();
        delete self.connector;
        self.connector = null;
      }

      if (self.root) {
        self.root.status = 0;
        self.root.destroy();
      }

      self.watch.removeListeners.apply(self);

      self._current = null;
      self._queue = [];

      self.emit('disconnected');
      self.status = 'NOT_CONNECTED';


      return self;
    }

    toRemote(local) {
      const self = this;
      let strToMatch = 'code/';
      let regForReplace = /^.*code/;
      if (process.platform == 'win32') {
        strToMatch = 'code\\';
        regForReplace = /^.*code\\/;
      }
      if (local.indexOf(strToMatch) > 0) {
        return Path.join(
          self.info.remote,
          local.replace(regForReplace, '')
        ).replace(/\\/g, '/');
      }
      return Path.join(
        self.info.remote,
        atom.project.relativize(local)
      ).replace(/\\/g, '/');
    }

    toLocal(remote) {
      const self = this;
      const projectPath = self.getProjectPath();

      if (projectPath === false) return false;
      if (typeof remote !== 'string') {
        throw new Error(`Commit Live IDE: remote must be a string, was passed ${typeof remote}`);
      }
      return Path.resolve(projectPath, `./${remote.substr(self.info.remote.length).replace(/^\/+/, '')}`);
    }

    _next() {
      const self = this;

      if (!self.isConnected()) return;

      self._current = self._queue.shift();

      if (self._current) self._current[1].apply(self, [self._current[2]]);

      atom.project.remoteftp.emit('queue-changed');
    }

    _enqueue(func, desc) {
      const self = this;
      const progress = new Progress();

      self._queue.push([desc, func, progress]);
      if (self._queue.length == 1 && !self._current) self._next();

      else self.emit('queue-changed');

      return progress;
    }

    abort() {
      const self = this;

      if (self.isConnected()) {
        self.connector.abort(() => {
          self._next();
        });
      }

      return self;
    }

    abortAll() {
      const self = this;

      self._current = null;
      self._queue = [];

      if (self.isConnected()) {
        self.connector.abort();
      }

      self.emit('queue-changed');

      return self;
    }

    list(remote, recursive, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue(() => {
          self.connector.list(remote, recursive, function () {
            if (typeof callback === 'function') callback(...arguments);
            self._next();
          });
        }, `Listing ${recursive ? 'recursively ' : ''}${Path.basename(remote)}`);
      });

      return self;
    }

    download(remote, recursive, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue((progress) => {
          self.connector.get(remote, recursive, function () {
            if (typeof callback === 'function') callback(...arguments);
            self._next();
          }, (percent) => {
            progress.setProgress(percent);
          });
        }, `Downloading ${Path.basename(remote)}`);
      });

      return self;
    }

    upload(local, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue((progress) => {
          self.connector.put(local, function () {
            if (typeof callback === 'function') callback(...arguments);
            self._next();
          }, (percent) => {
            progress.setProgress(percent);
          });
        }, `Uploading ${Path.basename(local)}`);
      });

      return self;
    }

    traverseTree(rootPath, callback) {
      const list = [];
      const queue = [rootPath];

      // search all files in rootPath recursively
      while (queue.length > 0) {
        const currentPath = queue.pop();
        const filesFound = FS.readdirSync(currentPath);

        for (const fileName of filesFound) {
          if (fileName !== '.' && fileName !== '..') {
            const fullName = Path.join(currentPath, fileName);

            const stats = FS.statSync(fullName);
            list.push({
              name: fullName,
              size: stats.size,
              date: stats.mtime,
              type: stats.isFile() ? 'f' : 'd',
            });

            if (!stats.isFile()) queue.push(fullName);
          }
        }
      }

      // depth counting & sorting
      for (const file of list) {
        file.depth = file.name.split('/').length;
      }
      list.sort((a, b) => {
        if (a.depth === b.depth) return 0;
        return a.depth > b.depth ? 1 : -1;
      });

      // callback
      if (typeof callback === 'function') callback.apply(null, [list]);
    }

    syncRemoteLocal(remote, isFile, callback) {
      // TODO: Tidy up this function. Does ( probably ) not need to list from the connector
      // if isFile === true. Will need to check to see if that doesn't break anything before
      // implementing. In the meantime current solution should work for #453
      const self = this;

      if (!remote) return;

      self.onceConnected(() => {
        self._enqueue(() => {
          const local = self.toLocal(remote);

          self.connector.list(remote, true, (err, remotes) => {
            if (err) {
              if (typeof callback === 'function') callback.apply(null, [err]);

              return;
            }

            self.traverseTree(local, (locals) => {
              const error = function () {
                if (typeof callback === 'function') callback.apply(null);
                self._next();
                return;
              };
              const n = function () {
                const remote = remotes.shift();
                let toLocal;
                let local;

                if (!remote) return error();


                if (remote.type === 'd') return n();

                toLocal = self.toLocal(remote.name);
                local = null;

                for (let a = 0, b = locals.length; a < b; ++a) {
                  if (locals[a].name === toLocal) {
                    local = locals[a];
                    break;
                  }
                }

                // Download only if not present on local or size differ
                if (!local || remote.size !== local.size) {
                  self.connector.get(remote.name, false, () => n());
                } else {
                  n();
                }
              };
              if (remotes.length === 0) {
                self.connector.get(remote, false, () => n());
                return;
              }
              n();
            });
          }, isFile);
          // NOTE: Added isFile to end of call to prevent breaking any functions
          // that already use list command. Is file is used only for ftp connector
          // as it will list a file as a file of itself unlinke with sftp which
          // will throw an error.
        }, `Sync local ${Path.basename(remote)}`);
      });
      return self;
    }

    syncLocalRemote(local, callback) {
      const self = this;

      self.onceConnected(() => {
        self._enqueue((progress) => {
          const remote = self.toRemote(local);

          self.connector.list(remote, true, (err, remotes) => {
            if (err) {
              if (typeof callback === 'function') callback.apply(null, [err]);
              return;
            }

            self.traverseTree(local, (locals) => {
              const error = function () {
                if (typeof callback === 'function') callback.apply(null);
                self._next();
                return;
              };

              // filter via .ftpignore
              const userInfoObj = JSON.parse(localStorage.getItem('commit-live:user-info'));
              const ftpIgnoreConfig = userInfoObj.servers.ftp_ignore_config;
              if (ftpIgnoreConfig) {
                ignoreFilter.add(ftpIgnoreConfig);
              }

              // remove ignored locals
              for (let i = locals.length - 1; i >= 0; i--) {
                if (ignoreFilter.ignores(locals[i].name)) {
                  locals.splice(i, 1); // remove from list
                }
              }

              const n = function () {
                const local = locals.shift();
                let remote;

                if (!local) return error();

                if (local.type === 'd') return n();

                const toRemote = self.toRemote(local.name);
                remote = null;

                for (let a = 0, b = remotes.length; a < b; ++a) {
                  if (remotes[a].name === toRemote) {
                    remote = remotes[a];
                    break;
                  }
                }

                // NOTE: Upload only if not present on remote or size differ
                if (!remote || remote.size !== local.size) {
                  self.connector.put(local.name, () => n());
                } else {
                  n();
                }
              };
              n();
            });
          });
        }, `Sync remote ${Path.basename(local)}`);
      });

      return self;
    }

    mkdir(remote, recursive, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue(() => {
          self.connector.mkdir(remote, recursive, function () {
            if (typeof callback === 'function') callback(...arguments);
            self._next();
          });
        }, `Creating folder ${Path.basename(remote)}`);
      });

      return self;
    }

    mkfile(remote, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue(() => {
          self.connector.mkfile(remote, function () {
            if (typeof callback === 'function') callback(...arguments);
            self._next();
          });
        }, `Creating file ${Path.basename(remote)}`);
      });

      return self;
    }

    rename(source, dest, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue(() => {
          self.connector.rename(source, dest, (err) => {
            if (typeof callback === 'function') callback.apply(null, [err]);
            self._next();
          });
        }, `Renaming ${Path.basename(source)}`);
      });
      return self;
    }

    delete(remote, callback) {
      const self = this;
      self.onceConnected(() => {
        self._enqueue(() => {
          self.connector.delete(remote, function () {
            if (typeof callback === 'function') callback(...arguments);
            self._next();
          });
        }, `Deleting ${Path.basename(remote)}`);
      });

      return self;
    }

    promptForPass() {
      const self = this;
      const dialog = new PromptPassDialog('', true);
      dialog.on('dialog-done', (e, pass) => {
        self.info.pass = pass;
        self.info.passphrase = pass;
        dialog.close();
        self.doConnect();
      });
      dialog.attach();
    }

    connectToFTP(isReconnecting) {
      if (this.isConnected()) return;
      this.readConfig(() => {
        this.connect(null, isReconnecting);
      });
    }

    deleteFile(filePath, shouldChangePerm) {
      const fileExists = FS.existsSync(filePath);
      if (fileExists) {
        if (shouldChangePerm) {
          FS.chmodSync(filePath, '700');
        }
        FS.unlinkSync(filePath);
      }
    }

    removeConfigFiles() {
      this.deleteFile(this.getPemFilePath(), true);
      const ftpConfigKey = atom.config.get('greyatom-tree-view.ftp-config-key');
      localStorage.removeItem(ftpConfigKey);
      const ftpIgnoreConfigKey = atom.config.get('greyatom-tree-view.ftp-ignore-config-key');
      localStorage.removeItem(ftpIgnoreConfigKey);
    }

    removeLocalCodebase() {
      const localCodePath = this.getLocalProjectPath();
      const localCodeExists = FS.existsSync(localCodePath);
      if (localCodeExists) {
        rimraf(localCodePath, (err) => {});
      }
    }

    downloadPemFile(callback, isReconnecting) {
      let popUpMsg = "Commit Live IDE: Preparing to connect...";
      if (isReconnecting) {
        popUpMsg = "Commit Live IDE: Few more minutes...";
      }
      const downloadingFilePopup = new Notification("info", popUpMsg, {
        dismissable: true
      });
      atom.notifications.addNotification(downloadingFilePopup)
      const pemFilePath = this.getPemFilePath();
      const userInfo = JSON.parse(localStorage.getItem('commit-live:user-info'));
      const apiForPem = userInfo.keySecretUrl;
      const cb = function(response) {
        if (response.statusCode === 200) {
          const file = FS.createWriteStream(pemFilePath);
          response.pipe(file);
          file.on('finish', function () {
            downloadingFilePopup.dismiss();
            callback(null);
          });
        }
      }
      if (navigator.onLine) {
        if (apiForPem.indexOf('https://') !== -1) {
          const pemFileRequest = https.get(apiForPem, cb);
        } else {
          const pemFileRequest = http.get(apiForPem, cb);
        }
      } else {
        atom.notifications.addError('Commit Live IDE', {
          detail: 'No Internet Connection',
          dismissable: false,
        });
      }
    }

    connectToStudentFTP(isReconnecting) {
      const self = this;
      if (self.isConnected()) return;
      series([
          (callback) => {
            self.downloadPemFile.call(self, callback, isReconnecting)
          }
        ],
        function (err) {
          if (!err) {
            self.connectToFTP(isReconnecting);
            if (self.reconnectPopup) {
              self.reconnectPopup.dismiss();
            }
          }
        });
    }

    disconnectStudentFtp() {
      if (!this.isConnected()) return;
      this.disconnect();
      this.removeConfigFiles();
      this.removeLocalCodebase();
    }

    showReconnectPopup() {
      const self = this;
      if (!self.reconnectPopup) {
        self.reconnectPopup = atom.notifications.addWarning('Commit Live IDE', {
          detail: "Oops, something went wrong!",
          description: 'Never mind, Hit Reconnect!',
          dismissable: true,
          buttons: [{
            text: 'Reconnect',
            onDidClick: () => {
              self.reconnectPopup.dismiss();
              self.reconnectPopup = null;
              self.disconnectStudentFtp();
              self.connectToStudentFTP();
            }
          }]
        });
      }
    }

    getPathForTrack(trackSlug) {
      const userInfoKey = atom.config.get('greyatom-tree-view.student-info-key');
      const data = localStorage.getItem(userInfoKey);
      const userInfo = JSON.parse(data);
      let dirPath = `/home/${userInfo.userName}/Workspace/code/`;
      const isTask = trackSlug.indexOf(':') !== -1;
      if (isTask) {
        const splitArr = trackSlug.split(':');
        dirPath += `${splitArr[0]}/${splitArr[1]}`;
      } else {
        dirPath += `${trackSlug}`;
      }
      return dirPath;
    }

    openTrack(trackSlug, fileName) {
      if (!atom.project['remoteftp-main'].treeView.isVisible()) return;
      this.abortAll();
      const dirPath = this.getPathForTrack(trackSlug)
      const readmePath = `${dirPath}/${fileName}`;
      const rootFolder = atom.project.remoteftp.root;
      rootFolder.isExpanded = true;
      rootFolder.open(false, () => {
        rootFolder.openPath(readmePath, fileName, false, () => {
          atom.workspace.getPanes().forEach(function(pane) {
            pane.destroy();
          });
        });
        if (trackSlug.indexOf(':') !== -1) {
          const solutionFileName = atom.config.get('greyatom-tree-view.solutionFileName');
          rootFolder.openPath(`${dirPath}/${solutionFileName}`, solutionFileName, true);
        }
      });
    }
  }

  return Client;
}());
