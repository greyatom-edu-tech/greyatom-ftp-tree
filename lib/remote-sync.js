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
  return $('.greyatom-tree-view-view span[data-path="' + path + '"]').closest(closestEle);
}

function getRemotes(path, fsEvent) {
  const views = getDirectoryElement(path, fsEvent).map(function () {
    const v = $(this).view();
    return v || null;
  }).get();
  return views;
}

const callback = (msg) => {
  const parsed = JSON.parse(msg);
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
      atom.project.remoteftp.root.openLesson(parsed.title);
      break;
  }
}

const listenForChanges = function () {
  atom.project.remoteftp.on('connected', () => {
    if (!connected) {
      const wsEndpoint = atom.config.get('greyatom-tree-view.websocket-endpoint');
      socket = io.connect(wsEndpoint, { reconnect: true });
      socket.on('connect', function() {
        socket.emit('room', 'surajhell88');
        connected = true;
      });
      socket.on('message', callback);
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