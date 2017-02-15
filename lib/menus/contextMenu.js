'use babel';

const init = function INIT() {
  const atom = global.atom;
  const copyEnabled = () => atom.config.get('greyatom-tree-view.enableCopyFilename');
  const contextMenu = {
    '.greyatom-tree-view-view .entries.list-tree:not(.multi-select) .directory .header': {
      enabled: copyEnabled(),
      command: [{
        label: 'Copy name',
        command: 'greyatom-tree-view:copy-name',
      }, {
        type: 'separator',
      }],
    },
    '.greyatom-tree-view-view .entries.list-tree:not(.multi-select) .file': {
      enabled: copyEnabled(),
      command: [{
        label: 'Copy filename',
        command: 'greyatom-tree-view:copy-name',
      }, {
        type: 'separator',
      }],
    },
  };
  return contextMenu;
};


export default init;
