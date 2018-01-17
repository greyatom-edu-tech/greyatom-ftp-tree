'use babel';

let __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (const key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  $ = require('atom-space-pen-views').$,
  _ = require('lodash'),
  AssignmentView = require('./assignment-view'),
  getIconHandler = require('../helpers.js').getIconHandler,
  View = require('atom-space-pen-views').View,
  {CompositeDisposable} = require('atom');

module.exports = ProjectView = (function (parent) {
  __extends(ProjectView, parent);

  function ProjectView(file) {
    ProjectView.__super__.constructor.apply(this, arguments);
  }

  ProjectView.content = function () {
    return this.div({
      class: 'project-view ga-ide-wrapper',
      outlet: 'projectView',
      tabindex: -1,
    }, () => {
      this.ul({
        class: 'list-group panel-collapse',
        tabindex: -1,
        outlet: 'projectList',
      });
    });
  };

  ProjectView.prototype.initialize = function () {
    // ProjectView.__super__.initialize.apply(this, arguments);
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.commands.add('atom-workspace', 'commit-live:refill-tasks', () => this.fillTasks())
    )
  };

  ProjectView.prototype.show = function () {
    $('.project-view.ga-ide-wrapper').show();
  };

  ProjectView.prototype.fillTasks = function () {
    localStorage.removeItem('commit-live:current-track')
    const lastProject = localStorage.getItem('commit-live:last-opened-project');
    if (this.projectList && lastProject) {
      this.projectList.empty();
      const {tracks} = JSON.parse(lastProject);
      const sortedTracks = _.sortBy(tracks, ['order'])
      const onlyCodeTracks = _.filter(sortedTracks, ['type', 'CODE']);
      this.projectList.append(onlyCodeTracks.reduce(
        (collection, nextVal) => {
          return [
          ...collection,
          new AssignmentView(nextVal)
          ];
        },
        []
      ));
    }
  };

  ProjectView.prototype.hide = function () {
    $('.project-view.ga-ide-wrapper').hide();
  };

  ProjectView.prototype.destroy = function () {
    this.remove();
    this.subscriptions.dispose();
  };

  return ProjectView;
}(View));
