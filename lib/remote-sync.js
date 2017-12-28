'use babel';

import File from './file';
const _ = require('lodash');
const $ = require('atom-space-pen-views').$
const io = require('socket.io-client');
let connected = false;
let socket;

function getDirectoryElement(path, fsEvent) {
  var closestEle = 'li.directory';
  if (fsEvent == 'changeFile') {
    closestEle = 'li.file';
  }
  return $('.greyatom-tree-view span[data-path="' + path + '"]').closest(closestEle);
}

function getRemotes(path, fsEvent) {
  const views = getDirectoryElement(path, fsEvent).map(function () {
    const v = $(this).view();
    return v || null;
  }).get();
  return views;
}

const callback = (msg) => {
  if (msg.data !== 'ping') {
    try {
      const parsed = JSON.parse(msg.data);
      switch (parsed.type) {
        case 'remote-file-change':
          if (parsed.title == 'changeFile') {
            return;
          }
          const remotes = getRemotes(parsed.message, parsed.title);
          remotes.forEach((remote) => {
            remote.open();
          });
          break;
        case 'open-lesson':
          const userInfoKey = atom.config.get('greyatom-tree-view.student-info-key');
          const data = localStorage.getItem(userInfoKey);
          const userInfo = JSON.parse(data);
          let dirPath = `/home/${userInfo.userName}/Workspace/code/`;
          const isTask = parsed.title.indexOf(':') !== -1;
          if (isTask) {
            const splitArr = parsed.title.split(':');
            dirPath += `${splitArr[0]}/${splitArr[1]}`;
          } else {
            dirPath += `${parsed.title}`;
          }
          const readmePath = `${dirPath}/${parsed.message.fileName}`;
          const rootFolder = atom.project.remoteftp.root;
          rootFolder.isExpanded = true;
          rootFolder.open(false, () => {
            rootFolder.openPath(readmePath, parsed.message.fileName);
            if (isTask) {
              const solutionFileName = 'build.py';
              rootFolder.openPath(`${dirPath}/${solutionFileName}`, solutionFileName, true);
            }
          });
          break;
      }
    } catch (e) {
      console.log('Invalid JSON', e);
    }
  }
}

const listenForChanges = function () {
  atom.project.remoteftp.on('connected', () => {
    if (!connected) {
      const wsEndpoint = atom.config.get('greyatom-tree-view.websocket-endpoint');
      socket = io.connect(wsEndpoint, { reconnect: true });
      const userInfoKey = atom.config.get('greyatom-tree-view.student-info-key');
      const data = localStorage.getItem(userInfoKey);
      const userInfo = JSON.parse(data);
      socket.on('connect', function() {
        if (userInfo.userName) {
          socket.emit('join', {
            room: userInfo.userName
          });
        }
        connected = true;
      });
      socket.on('my_response', callback);
    }
  });
  atom.project.remoteftp.on('closed', () => {
    if (connected) {
      connected = false;
      socket.close();
    }
  });
};

export default listenForChanges;