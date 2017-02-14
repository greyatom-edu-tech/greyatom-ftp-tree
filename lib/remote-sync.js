'use babel';

import File from './file';
const _ = require('lodash');
const $ = require('atom-space-pen-views').$
const io = require('socket.io-client');
const socket = io.connect('http://35.154.96.42:9000', { reconnect: true });

socket.on('connect', function() {
  socket.emit('room', 'surajhell88');
});

function getRemotes() {
  const views = $('.remote-ftp-view .project-root').map(function () {
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

socket.on('message', throttledFn);