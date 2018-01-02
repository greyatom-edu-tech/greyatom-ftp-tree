'use babel';

import FS from 'fs-plus';
import Path from 'path';
import Client from './client';
import TreeView from './views/tree-view';
import RemoteFileSearchView from './remote-file-search-view';
import {
  hasProject,
  setIconHandler,
} from './helpers';
import initCommands from './menus/main';

import { Disposable } from 'atom';
import listenForChanges from './remote-sync';
const atom = global.atom;
const config = require('./config-schema.json');
const {name} = require('../package.json');

class Main {

  constructor() {
    const self = this;
    self.config = config;
    self.treeView = null;
    self.client = null;
    self.listeners = [];
  }

  activate(state) {
    const self = this;

    self.client = new Client();
    atom.project['remoteftp-main'] = self; // change remoteftp to object containing client and main?
    atom.project.remoteftp = self.client;
    atom.project.remoteftp.removeConfigFiles();
    self.treeView = new TreeView();

    self.treeView.detach();

    self.client.on('connected', () => {
      self.treeView.root.name.attr('data-name', Path.basename(self.client.root.remote));
      self.treeView.root.name.attr('data-path', self.client.root.remote);
    });

    // NOTE: Adds commands to context menus and atom.commands
    initCommands();

    atom.workspace.observeTextEditors((ed) => {
      const buffer = ed.buffer;
      const listener = buffer.onDidSave(self.fileSaved.bind(self));
      self.listeners.push(listener);
    });

    listenForChanges();
    this.remoteFileSearchView = new RemoteFileSearchView(state.remoteFileSearchViewState);
    process.nextTick(function () {
      atom.config.set('autosave.enabled', true);
    });
  }

  deactivate() {
    const self = this;
    self.listeners.forEach(listener => listener.dispose());
    self.listeners = [];
    if (self.client) self.client.disconnect();
    this.remoteFileSearchView.destroy();
  }

  fileSaved(text) {
    const self = this;
    if (!hasProject()) return;

    if (atom.config.get('greyatom-tree-view.autoUploadOnSave') === 'never') return;

    if (!self.client.isConnected() && atom.config.get('greyatom-tree-view.autoUploadOnSave') !== 'always') return;

    const local = text.path;
    // TODO: Add fix for files which are uploaded from a glob selector
    // don't upload files watched, they will be uploaded by the watcher
    // doesn't work fully with new version of watcher
    if (self.client.watch.files.indexOf(local) >= 0) return;

    self.client.upload(local, () => {
      try {
        const remote = self.client.toRemote(local);
        const parent = self.client.resolve(Path.dirname(remote)
          .replace(/\\/g, '/'));
        if (parent) parent.open();
      } catch (e) {}
    });
  }

  consumeElementIcons(fn) {
    setIconHandler(fn);
    return new Disposable(() => {
      setIconHandler(null);
    });
  }

  addButtonToToolbar(options) {
    return atom.project.remoteftp.toolBar.addButton(options)
  }

  consumeToolBar(getToolBar) {
    atom.config.set('tool-bar.position', 'Left');
    atom.project.remoteftp.toolBar = getToolBar(name);
    this.addButtonToToolbar({
      icon: 'tachometer',
      callback: 'commit-live:toggle-dashboard',
      tooltip: 'Dashboard',
      iconset: 'fa'
    })
    this.addButtonToToolbar({
      icon: 'terminal',
      callback: 'commit-live:toggle-terminal',
      tooltip: 'Toggle Terminal',
      iconset: 'fa'
    });
    this.addButtonToToolbar({
      icon: 'list',
      callback: 'commit-live:project-search',
      tooltip: 'Switch Project',
      iconset: 'fa'
    })
    this.addButtonToToolbar({
      icon: 'sign-out',
      callback: 'commit-live:log-in-out',
      tooltip: 'Logout',
      iconset: 'fa'
    })
    this.addButtonToToolbar({
      icon: 'bug',
      callback: () => {
        const track = localStorage.getItem('commit-live:current-track')
        if (track) {
          atom.commands.dispatch(atom.views.getView(atom.workspace), 'commit-live:test-task')
        } else {
          atom.notifications.addInfo('You need to select a task first!', {
            description: 'Select a task from the Task List given in the left sidebar',
            dismissable: false,
          });
        }
      },
      tooltip: 'Test',
      iconset: 'fa'
    })
    this.addButtonToToolbar({
      icon: 'paper-plane',
      callback: () => {
        const track = localStorage.getItem('commit-live:current-track')
        if (track) {
          atom.commands.dispatch(atom.views.getView(atom.workspace), 'commit-live:submit-task')
        } else {
          atom.notifications.addInfo('You need to select a task first!', {
            description: 'Select a task from the Task List given in the left sidebar',
            dismissable: false,
          });
        }
      },
      tooltip: 'Submit',
      iconset: 'fa'
    })
  }

}

export default new Main();
