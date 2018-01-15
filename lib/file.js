'use babel';

let __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (const key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  fs = require('fs-plus'),
  path = require('path'),
  Model = require('theorist').Model;

module.exports = File = (function (parent) {
  __extends(File, parent);

  File.properties({
    parent: null,
    name: '',
    client: null,
    status: 0,
    size: 0,
    date: null,
    type: null,
  });

  File.prototype.accessor('local', function () {
    if (this.parent)      { return path.normalize(path.join(this.parent.local, this.name)).replace(/\\/g, '/'); }
    throw 'File needs to be in a Directory';
  });

  File.prototype.accessor('remote', function () {
    if (this.parent)      { return path.normalize(path.join(this.parent.remote, this.name)).replace(/\\/g, '/'); }
    throw 'File needs to be in a Directory';
  });

  File.prototype.accessor('root', function () {
    if (this.parent)      { return this.parent.root; }
    return this;
  });

  function File() {
    File.__super__.constructor.apply(this, arguments);

    const ext = path.extname(this.name);
    if (fs.isReadmePath(this.name))     { this.type = 'readme'; } else if (fs.isCompressedExtension(ext))     { this.type = 'compressed'; } else if (fs.isImageExtension(ext))      { this.type = 'image'; } else if (fs.isPdfExtension(ext))     { this.type = 'pdf'; } else if (fs.isBinaryExtension(ext))      { this.type = 'binary'; } else      { this.type = 'text'; }
  }

  File.prototype.openReadmePreview = function () {
    editor = atom.workspace.getActiveTextEditor();
    if (editor) {
      grammars = atom.config.get('markdown-preview.grammars') || []
      if (grammars.indexOf(editor.getGrammar().scopeName) !== -1) {
        previousTextEditor = atom.workspace.getActiveTextEditor();
        atom.commands.dispatch(atom.views.getView(atom.workspace), 'markdown-preview:toggle');
        setTimeout(() => {
          try {
            const panes = atom.workspace.getPanes();
            const firstPane = panes[0];
            const readmePane = panes[1];
            const readmePreview = readmePane.getItems()[0];
            readmePane.removeItem(readmePreview);
            firstPane.addItem(readmePreview, {moved: true});
            firstPane.setActiveItem(readmePreview);
            previousTextEditor.destroy();
          } catch (e) {
            console.log(e); // eslint-disable-line
          }
        }, 0);
      }
    }
  }

  File.prototype.open = function (splitRight = false) {
    let self = this,
      client = self.root.client;

    client.download(self.remote, false, (err) => {
      if (err) {
        atom.notifications.addError(`Commit Live: ${err}`, {
          dismissable: false,
        });
        return;
      }
      const options = {};
      if (splitRight) {
        options['split'] = 'right';
      }
      atom.workspace.open(self.local, options).then(() => {
        self.openReadmePreview();
      });
    });
  };

  return File;
}(Model));
