'use babel';

import FS from 'fs-plus';

let __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (const key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  $ = require('atom-space-pen-views').$,
  DirectoryView = require('./directory-view'),
  ScrollView = require('atom-space-pen-views').ScrollView,
  getObject = require('../helpers').getObject;

let hideLocalTreeError = false;

function hideLocalTree() {
  const treeView = getObject({
    obj: atom.packages.loadedPackages,
    keys: ['tree-view', 'mainModule', 'treeView'],
  });

  if (treeView && typeof treeView.detach === 'function') { // Fix for Issue 433 ( workaround to stop throwing error)
    try {
      treeView.detach();
    } catch (e) {
      if (hideLocalTreeError === false) {
        atom.notifications.addWarning('Commit Live: See issue #433', {
          dismissable: false,
        });
        hideLocalTreeError = true;
      }
    }
  }
}

function showLocalTree() {
  const treeView = getObject({
    obj: atom.packages.loadedPackages,
    keys: ['tree-view', 'mainModule', 'treeView'],
  });
  if (treeView && typeof treeView.detach === 'function') treeView.attach();
}

module.exports = TreeView = (function (parent) {
  __extends(TreeView, parent);

  const resizeCursor = process.platform === 'win32' ? 'ew-resize' : 'col-resize';

  function TreeView() {
    TreeView.__super__.constructor.apply(this, arguments);
  }

  TreeView.content = function () {
    return this.div({
      class: 'greyatom-tree-view ftptree-view-resizer tool-panel',
      'data-show-on-right-side': atom.config.get('tree-view.showOnRightSide'),
    }, () => {
      this.ul({
        class: 'list-inline tab-bar inset-panel',
        outlet: 'tabBar',
        tabindex: -1,
      }, () => {
        this.li({
          class:'tab sortable',
          outlet: 'projectTab',
          tabindex: -1,
          style: 'flex: 1;',
        }, () => {
          this.div({
            class: 'title',
            tabindex: -1,
            outlet: 'projectTabTitle',
          });
        });
        this.li({
          class:'tab sortable',
          outlet: 'fileTreeTab',
          tabindex: -1,
          style: 'flex: 1;',
        }, () => {
          this.div({
            class: 'title',
            tabindex: -1,
            outlet: 'fileTreeTabTitle',
            text: 'File Tree',
          });
        });
      });
      this.div({
        class: 'project-screen',
        outlet: 'projectScreen',
        tabindex: -1,
      }, () => {
        this.a({
          class: 'active',
          tabindex: -1,
        }, () => {
          this.span({
            class: 'glyphicon glyphicon-adjust gacomplete-chapt-incomplete',
            tabindex: -1,
          });
          this.span({
            class: 'label-text sub-mod-title',
            tabindex: -1,
            outlet: 'projectTitleText',
          });
        });
        this.ul({
          class: 'list-group panel-collapse',
          tabindex: -1,
          outlet: 'projectList',
        });
      });
      this.div({
        class: 'scroller',
        outlet: 'scroller',
      }, () => {
        this.ol({
          class: 'ftptree-view full-menu list-tree has-collapsable-children focusable-panel',
          tabindex: -1,
          outlet: 'list',
        });
      });
      this.div({
        class: 'resize-handle',
        outlet: 'horizontalResize',
        style: `cursor:${resizeCursor}`, // platform specific cursor
      });
      this.div({
        class: 'queue tool-panel panel-bottom',
        tabindex: -1,
        outlet: 'queue',
      }, () => {
        this.ul({
          class: 'progress tool-panel panel-top',
          tabindex: -1,
          outlet: 'progress',
        });
        this.ul({
          class: 'list',
          tabindex: -1,
          outlet: 'debug',
        });
        return this.div({
          class: 'resize-handle',
          outlet: 'verticalResize',
        });
      });
      this.div({
        class: 'offline',
        tabindex: -1,
        outlet: 'offline',
      });
    });
  };

  const elapsedTime = function (ms) {
    const days = Math.floor(ms / 86400000);
    ms %= 86400000;
    const hours = Math.floor(ms / 3600000);
    ms %= 3600000;
    const mins = Math.floor(ms / 60000);
    ms %= 60000;
    const secs = Math.floor(ms / 1000);
    ms %= 1000;

    return ((days ? `${days}d ` : '') +
				(hours ? `${((days) && hours < 10 ? '0' : '') + hours}h ` : '') +
				(mins ? `${((days || hours) && mins < 10 ? '0' : '') + mins}m ` : '') +
				(secs ? `${((days || hours || mins) && secs < 10 ? '0' : '') + secs}s ` : '')).replace(/^[dhms]\s+/, '').replace(/[dhms]\s+[dhms]/g, '').replace(/^\s+/, '').replace(/\s+$/, '') || '0s';
  };

  TreeView.prototype.initialize = function (state) {
    TreeView.__super__.initialize.apply(this, arguments);

    const self = this;

		// self.addClass(atom.config.get('tree-view.showOnRightSide') ? 'panel-right' : 'panel-left');
    let html = '<ul>';
    html += '<li><a role="connect" class="btn btn-default icon">Login</a><br /></li>';
    html += '</ul>';
    self.offline.html(html);
    if (atom.project.remoteftp.isConnected())			{ self.showOnline(); } else			{ self.showOffline(); }

    self.root = new DirectoryView(atom.project.remoteftp.root);
    self.root.expand();
    self.list.append(self.root);
    self.projectTabTitle.text('Project');
    self.fileTreeTabTitle.text('File Tree');
    self.tabBar.on('click', '.tab', function (e) {
      $('.greyatom-tree-view .tab').removeClass('active');
      $(e.target).closest('.tab').addClass('active');
      if (e.target.textContent == 'Project') {
        self.scroller.hide();
        self.projectScreen.show();
      } else {
        self.scroller.show();
        self.projectScreen.hide();
      }
    });
    const projectName = 'Work with the IPL data set and do a deeper dive on looping constructs and various data structures';
    const arrOfAssignments = [
      {
          "displayTitle": "Which teams played the match? Save the answer in the variable 'teams'."
      },
      {
          "displayTitle": "How many more \"extras\" (wides, legbyes, etc) were bowled in the second innings as compared to the first inning?"
      },
      {
          "displayTitle": "RT Ponting batted in the first innings. How many deliveries did he bat? Save the value in the variable count"
      },
      {
          "displayTitle": "Read the IPL Data File"
      },
      {
          "displayTitle": "How many runs did BC McCullum make? Save the value in the variable runs."
      },
      {
          "displayTitle": "Find the name of the batsman who played the first ball of the first innings. Save the value in the variable name"
      },
      {
          "displayTitle": "Find the names of all players that got bowled out in the second innings. Save the value in the variable bowled_players"
      }
    ];
    let li = '';
    arrOfAssignments.forEach((assignment) => {
      li += '<li><a class="completed" href="#"><div class="lesson-name"><span class="glyphicon glyphicon-ok gacomplete-chapt" aria-hidden="true"></span><span class="fa fa-code coder" aria-hidden="true"></span><span class="label-text">' + assignment.displayTitle + '</span></div></a></li>';
    });
    self.projectTitleText.text(projectName);
    self.projectList.append(li);
    self.scroller.hide();
    self.projectTab.addClass('active');

		// self.attach();

		// Events
    atom.config.onDidChange('tree-view.showOnRightSide', () => {
      if (self.isVisible()) {
        setTimeout(() => {
          self.detach();
          self.attach();
        }, 1);
      }
    });
    atom.config.onDidChange('greyatom-tree-view.hideLocalWhenDisplayed', (values) => {
      if (values.newValue) {
        if (self.isVisible()) {
          hideLocalTree();
        }
      } else if (self.isVisible()) {
        self.detach();
        showLocalTree();
        self.attach();
      } else {
        showLocalTree();
      }
    });

    atom.project.remoteftp.on('debug', (msg) => {
      self.debug.prepend(`<li>${msg}</li>`);
      const children = self.debug.children();
      if (children.length > 20)				{ children.last().remove(); }
    });
    atom.project.remoteftp.on('queue-changed', () => {
      self.progress.empty();

      const queue = [];
      if (atom.project.remoteftp._current)				{ queue.push(atom.project.remoteftp._current); }
      for (let i = 0, l = atom.project.remoteftp._queue.length; i < l; ++i)				{ queue.push(atom.project.remoteftp._queue[i]); }

      if (queue.length === 0)				{ self.progress.hide(); } else {
        self.progress.show();

        queue.forEach((queue) => {
          let $li = $(`<li><progress class="inline-block" /><div class="name">${queue[0]}</div><div class="eta">-</div></li>`),
            $progress = $li.children('progress'),
            $eta = $li.children('.eta'),
            progress = queue[2];
          self.progress.append($li);

          progress.on('progress', (percent) => {
            if (percent == -1) {
              $progress.removeAttr('max').removeAttr('value');
              $eta.text('-');
            } else {
              $progress.attr('max', 100).attr('value', parseInt(percent * 100, 10));
              const eta = progress.getEta();
              $eta.text(elapsedTime(eta));
            }
          });
          progress.once('done', () => {
            progress.removeAllListeners('progress');
          });
        });
      }
    });

    self.offline.on('click', '[role="connect"]', (e) => {
      atom.project.remoteftp.connectToStudentFTP();
    });
    self.offline.on('click', '[role="configure"]', (e) => {
      atom.workspace.open(atom.project.remoteftp.getConfigPath());
    });
    self.offline.on('click', '[role="configure_ignored"]', (e) => {
      atom.workspace.open(atom.project.getDirectories()[0].resolve('.ftpignore'));
    });
    self.offline.on('click', '[role="toggle"]', (e) => {
      self.toggle();
    });
    self.horizontalResize.on('dblclick', (e) => { self.resizeToFitContent(e); });
    self.horizontalResize.on('mousedown', (e) => { self.resizeHorizontalStarted(e); });
    self.verticalResize.on('mousedown', (e) => { self.resizeVerticalStarted(e); });
    self.list.on('keydown', (e) => { self.remoteKeyboardNavigation(e); });

    atom.project.remoteftp.on('connected', () => {
      self.attach();
      self.showOnline();
    });
		// atom.project.remoteftp.on('closed', function () {
    atom.project.remoteftp.on('disconnected', () => {
      self.showOffline();
      self.detach();
    });
  };

  TreeView.prototype.attach = function () {
    if (atom.config.get('tree-view.showOnRightSide')) {
      this.panel = atom.workspace.addRightPanel({ item: this });
    } else {
      this.panel = atom.workspace.addLeftPanel({ item: this });
    }

    if (atom.config.get('greyatom-tree-view.hideLocalWhenDisplayed'))			{ hideLocalTree(); } else			{ showLocalTree(); }
  };

  TreeView.prototype.detach = function () {
    TreeView.__super__.detach.apply(this, arguments);

    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
  };

  TreeView.prototype.toggle = function () {
    if (this.isVisible()) {
      this.detach();
    } else {
      this.attach();
    }
  };

  TreeView.prototype.showOffline = function () {
    this.list.hide();
    this.queue.hide();
    this.offline.css('display', 'flex');
  };

  TreeView.prototype.showOnline = function () {
    this.list.show();
    this.queue.show();
    this.offline.hide();
  };

  TreeView.prototype.resolve = function (path) {
    const view = $(`.greyatom-tree-view [data-path="${path}"]`).map(function () {
      const v = $(this).view();
      return v || null;
    }).get(0);

    return view;
  };

  TreeView.prototype.getSelected = function () {
    const views = $('.greyatom-tree-view .selected').map(function () {
      const v = $(this).view();
      return v || null;
    }).get();

    return views;
  };

  TreeView.prototype.resizeVerticalStarted = function (e) {
    e.preventDefault();

    this.resizeHeightStart = this.queue.height();
    this.resizeMouseStart = e.pageY;
    $(document).on('mousemove', this.resizeVerticalView.bind(this));
    $(document).on('mouseup', this.resizeVerticalStopped);
  };

  TreeView.prototype.resizeVerticalStopped = function () {
    delete this.resizeHeightStart;
    delete this.resizeMouseStart;
    $(document).off('mousemove', this.resizeVerticalView);
    $(document).off('mouseup', this.resizeVerticalStopped);
  };

  TreeView.prototype.resizeVerticalView = function (e) {
    if (e.which !== 1)			{ return this.resizeVerticalStopped(); }

    let delta = e.pageY - this.resizeMouseStart,
      height = Math.max(26, this.resizeHeightStart - delta);

    this.queue.height(height);
    this.scroller.css('bottom', `${height}px`);
  };

  TreeView.prototype.resizeHorizontalStarted = function (e) {
    e.preventDefault();

    this.resizeWidthStart = this.width();
    this.resizeMouseStart = e.pageX;
    $(document).on('mousemove', this.resizeHorizontalView.bind(this));
    $(document).on('mouseup', this.resizeHorizontalStopped);
  };

  TreeView.prototype.resizeHorizontalStopped = function () {
    delete this.resizeWidthStart;
    delete this.resizeMouseStart;
    $(document).off('mousemove', this.resizeHorizontalView);
    $(document).off('mouseup', this.resizeHorizontalStopped);
  };

  TreeView.prototype.resizeHorizontalView = function (e) {
    if (e.which !== 1)			{ return this.resizeHorizontalStopped(); }

    let delta = e.pageX - this.resizeMouseStart,
      width = Math.max(50, this.resizeWidthStart + delta);

    this.width(width);
  };

  TreeView.prototype.resizeToFitContent = function (e) {
    e.preventDefault();

    this.width(1);
    this.width(this.list.outerWidth());
  };

  TreeView.prototype.remoteKeyboardNavigation = function (e) {
    let arrows = { left: 37, up: 38, right: 39, down: 40 },
      keyCode = e.keyCode || e.which;

    switch (keyCode) {
      case arrows.up:
        this.remoteKeyboardNavigationUp();
        break;
      case arrows.down:
        this.remoteKeyboardNavigationDown();
        break;
      case arrows.left:
        this.remoteKeyboardNavigationLeft();
        break;
      case arrows.right:
        this.remoteKeyboardNavigationRight();
        break;
      default:
        return;
    }

    e.preventDefault();
    e.stopPropagation();
    this.remoteKeyboardNavigationMovePage();
  };

  TreeView.prototype.remoteKeyboardNavigationUp = function () {
    let current = this.list.find('.selected'),
      next = current.prev('.entry:visible');
    if (next.length) {
      while (next.is('.expanded') && next.find('.entries .entry:visible').length) {
        next = next.find('.entries .entry:visible');
      }
    } else {
      next = current.closest('.entries').closest('.entry:visible');
    }
    if (next.length) {
      current.removeClass('selected');
      next.last().addClass('selected');
    }
  };

  TreeView.prototype.remoteKeyboardNavigationDown = function () {
    let current = this.list.find('.selected'),
      next = current.find('.entries .entry:visible');
    if (!next.length) {
      tmp = current;
      do {
        next = tmp.next('.entry:visible');
        if (!next.length) {
          tmp = tmp.closest('.entries').closest('.entry:visible');
        }
      } while (!next.length && !tmp.is('.project-root'));
    }
    if (next.length) {
      current.removeClass('selected');
      next.first().addClass('selected');
    }
  };

  TreeView.prototype.remoteKeyboardNavigationLeft = function () {
    const current = this.list.find('.selected');
    if (!current.is('.directory')) {
      next = current.closest('.directory');
      next.view().collapse();
      current.removeClass('selected');
      next.first().addClass('selected');
    } else {
      current.view().collapse();
    }
  };

  TreeView.prototype.remoteKeyboardNavigationRight = function () {
    const current = this.list.find('.selected');
    if (current.is('.directory')) {
      const view = current.view();
      view.open();
      view.expand();
    }
  };

  TreeView.prototype.remoteKeyboardNavigationMovePage = function () {
    const current = this.list.find('.selected');
    if (current.length) {
      let scrollerTop = this.scroller.scrollTop(),
        selectedTop = current.position().top;
      if (selectedTop < scrollerTop - 10) {
        this.scroller.pageUp();
      } else if (selectedTop > scrollerTop + this.scroller.height() - 10) {
        this.scroller.pageDown();
      }
    }
  };

  return TreeView;
}(ScrollView));
