'use babel';

import File from './file';
const _ = require('lodash');
const $ = require('atom-space-pen-views').$
const io = require('socket.io-client');

function getRemotes() {
  const views = $('.greyatom-tree-view-view .project-root').map(function () {
    const v = $(this).view();
    return v || null;
  }).get();
  return views;
}

const throttledFn = _.throttle((msg) => {
  const parsed = JSON.parse(msg);
  if (parsed.type == 'remote-file-change') {
    // do a remote refresh
    const remotes = getRemotes();
    remotes.forEach((remote) => {
      remote.open();
    });
  }
}, 5000, { leading: true, 'trailing': false });

const listenForChanges = function () {
  const wsEndpoint = atom.config.get('greyatom-tree-view.websocket-endpoint');
  const socket = io.connect(wsEndpoint, { reconnect: true });

  socket.on('connect', function() {
    socket.emit('room', 'surajhell88');
  });
  
  socket.on('message', throttledFn);
}

export default listenForChanges;