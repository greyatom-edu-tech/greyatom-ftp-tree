'use babel';

let __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (const key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  $ = require('atom-space-pen-views').$,
  AssignmentView = require('./assignment-view'),
  getIconHandler = require('../helpers.js').getIconHandler,
  View = require('atom-space-pen-views').View;

module.exports = ProjectTitle = (function (parent) {
  __extends(ProjectTitle, parent);

  function ProjectTitle(file) {
    ProjectTitle.__super__.constructor.apply(this, arguments);
    this.panel = atom.workspace.addTopPanel({
      item: this, 
      visible: false, 
      className: 'commit-live-project-title'
    })
  }

  ProjectTitle.content = function () {
    return this.div({
      class: 'commit-live-project-bar',
      outlet: 'projectTitle',
      tabindex: -1,
    }, () => {
      this.h2({
        class: 'commit-live-project-title',
        tabindex: -1,
        outlet: 'projectTitle'
      });
      // this.h3({
      //   class: 'commit-live-task-title',
      //   tabindex: -1,
      //   outlet: 'taskTitle',
      // });
    });
  };

  ProjectTitle.prototype.initialize = function () {
    // ProjectTitle.__super__.initialize.apply(this, arguments);

    const self = this;
    self.projectTitle.text('Current Project: Work with the IPL data set and do a deeper dive on looping constructs and various data structures')
    // self.taskTitle.text("Selected Task: Which teams played the match? Save the answer in the variable 'teams'.")
  };

  ProjectTitle.prototype.toggle = function () {
    if(this.panel.isVisible()) {
      this.panel.hide()
    }
    else {
      this.panel.show()
    }
  }

  ProjectTitle.prototype.show = function () {
    this.panel.show()
  }

  ProjectTitle.prototype.hide = function () {
    this.panel.hide()
  }

  ProjectTitle.prototype.destroy = function () {
    this.remove();
  };

  return ProjectTitle;
}(View));

