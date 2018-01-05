'use babel';

let __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (const key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  $ = require('atom-space-pen-views').$,
  getIconHandler = require('../helpers.js').getIconHandler,
  View = require('atom-space-pen-views').View;

module.exports = AssignmentView = (function (parent) {
  __extends(AssignmentView, parent);

  function AssignmentView(file) {
    AssignmentView.__super__.constructor.apply(this, arguments);
  }

  AssignmentView.content = function () {
    return this.li({
      class: 'track-item',
    }, () => this.a({
      href: '#',
    }, () => this.div({
      class: 'lesson-name',
    }, () => {
      this.div({
        'aria-hidden': true,
        outlet: 'status'
      });
      this.div({
        class: 'label-text',
        outlet: 'name',
      });
    }))
    );
  };

  /*
  <li>
    <a class="completed" href="#">
      <div class="lesson-name">
        <span class="glyphicon glyphicon-ok gacomplete-chapt" aria-hidden="true"></span>
        <span class="fa fa-code coder" aria-hidden="true"></span>
        <span class="label-text">' + assignment.displayTitle + '</span>
      </div>
    </a>
  </li>
  */
  AssignmentView.prototype.initialize = function (track) {
    // AssignmentView.__super__.initialize.apply(this, arguments);

    const self = this;

    self.data = track;
    const $status = self.status[0];
    if (track.status == 'completed') {
      $status.classList.add('glyphicon', 'glyphicon-ok', 'gacomplete-chapt');
    } else if (track.status == 'active') {
      $status.classList.add('glyphicon', 'glyphicon-adjust', 'gacomplete-chapt-incomplete');
    } else {
      $status.classList.add('fa', 'fa-circle-o');
    }

    self.name.text(track.displayTitle);

    // Events
    self.on('mousedown', function (e) {
      e.stopPropagation();
      const view = $(this).view();
      if (!view) return;
      const $selected = $('.greyatom-tree-view .track-item a.active');
      if ($selected.length > 0) {
        $selected.removeClass('active');
      }
      view.find('a').toggleClass('active');
      view.open();
    });
  };

  AssignmentView.prototype.destroy = function () {
    this.remove();
  };

  AssignmentView.prototype.open = function () {
    localStorage.setItem('commit-live:current-track', JSON.stringify(this.data))
    const detailsFileName = atom.config.get('greyatom-tree-view.detailsFileName')
    atom.project.remoteftp.openTrack(this.data.titleSlugTestCase, detailsFileName)
  };

  return AssignmentView;
}(View));
