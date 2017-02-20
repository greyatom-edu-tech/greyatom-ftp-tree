'use babel';

import File from './file';
const _ = require('lodash');
const $ = require('atom-space-pen-views').$
const io = require('socket.io-client');

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
  if (parsed.type == 'remote-file-change') {
    // do a remote refresh
    if (parsed.title == 'changeFile') {
      return;
    }
    const remotes = getRemotes(parsed.message, parsed.title);
    remotes.forEach((remote) => {
      remote.open();
    });
  }
}

const listenForChanges = function () {
  const wsEndpoint = atom.config.get('greyatom-tree-view.websocket-endpoint');
  const socket = io.connect(wsEndpoint, { reconnect: true });

  socket.on('connect', function() {
    socket.emit('room', 'surajhell88');
  });
  
  socket.on('message', callback);
}

export default listenForChanges;