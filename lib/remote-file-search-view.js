'use babel';

import { CompositeDisposable } from 'atom';
import SelectList from 'atom-select-list';
import path from 'path'
import fuzzaldrin from 'fuzzaldrin'
import fuzzaldrinPlus from 'fuzzaldrin-plus'

function highlight (path, matches, offsetIndex) {
  let lastIndex = 0
  let matchedChars = []
  const fragment = document.createDocumentFragment()
  for (let matchIndex of matches) {
    matchIndex -= offsetIndex
    // If marking up the basename, omit path matches
    if (matchIndex < 0) {
      continue
    }
    const unmatched = path.substring(lastIndex, matchIndex)
    if (unmatched) {
      if (matchedChars.length > 0) {
        const span = document.createElement('span')
        span.classList.add('character-match')
        span.textContent = matchedChars.join('')
        fragment.appendChild(span)
        matchedChars = []
      }

      fragment.appendChild(document.createTextNode(unmatched))
    }

    matchedChars.push(path[matchIndex])
    lastIndex = matchIndex + 1
  }

  if (matchedChars.length > 0) {
    const span = document.createElement('span')
    span.classList.add('character-match')
    span.textContent = matchedChars.join('')
    fragment.appendChild(span)
  }

  // Remaining characters are plain text
  fragment.appendChild(document.createTextNode(path.substring(lastIndex)))
  return fragment
}

export default class RemoteFileSearchView {

  constructor(serializedState) {
    this.selectList = new SelectList({
      items: [],
      emptyMessage: "Fetching...",
      maxResults: 10,
      elementForItem: (item) => {
        const filePath = item.replace(atom.project.remoteftp.root.path, '');
        const filterQuery = this.selectList.getFilterQuery();
        const li = document.createElement('li');
        li.classList.add('two-lines');
        const matches = fuzzaldrinPlus.match(filePath, filterQuery)

        const fileBasename = path.basename(filePath);
        const baseOffset = filePath.length - fileBasename.length;
        const primaryLine = document.createElement('div');
        primaryLine.classList.add('primary-line', 'file', 'icon', 'icon-file-text');
        primaryLine.dataset.name = fileBasename;
        primaryLine.dataset.path = filePath;
        primaryLine.appendChild(highlight(fileBasename, matches, baseOffset));
        li.appendChild(primaryLine);

        const secondaryLine = document.createElement('div');
        secondaryLine.classList.add('secondary-line', 'path', 'no-icon');
        secondaryLine.appendChild(highlight(filePath, matches, 0))
        li.appendChild(secondaryLine);
        return li;
      },
      didCancelSelection: () => { 
        this.modalPanel.hide();
      },
      didConfirmSelection: (item) => {
        const fileBasename = path.basename(item);
        atom.project.remoteftp.root.openPath(item, fileBasename);
        this.modalPanel.hide();
      },
    });
    this.selectList.element.classList.add('remote-file-search');

    this.modalPanel = atom.workspace.addModalPanel({
      item: this.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'commit-live-file-search:toggle': () => {
        if (atom.project.remoteftp && atom.project.remoteftp.isConnected()) {
          this.toggle()
        }
      }
    }));
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.selectList.destroy();
  }

  getElement() {
    return this.selectList.element;
  }

  updateList(items, emptyMessage) {
    this.selectList.update({
      items,
      emptyMessage,
    });
  }

  fetchFileList() {
    this.updateList([], 'Fetching...');
    atom.project.remoteftp.list(atom.project.remoteftp.root.path, true, (err, list) => {
      if (list.length) {
        this.updateList(list
          .filter(item => item.type === 'f')
          .map(item => item.name)
        , '');
      } else {
        this.updateList([], 'No files found!');
      }
    });
  }

  toggle() {
    if (this.modalPanel.isVisible()) {
      this.modalPanel.hide();
    } else {
      this.fetchFileList();
      this.modalPanel.show();
      this.selectList.focus();
    }
  }

}
