'use babel';

let __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (const key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  $ = require('atom-space-pen-views').$,
  AssignmentView = require('./assignment-view'),
  getIconHandler = require('../helpers.js').getIconHandler,
  View = require('atom-space-pen-views').View;

module.exports = ProjectView = (function (parent) {
  __extends(ProjectView, parent);

  function ProjectView(file) {
    ProjectView.__super__.constructor.apply(this, arguments);
  }

  ProjectView.content = function () {
    return this.div({
      class: 'project-view',
      outlet: 'projectView',
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
  };

  ProjectView.prototype.initialize = function () {
    // ProjectView.__super__.initialize.apply(this, arguments);

    const self = this;

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
    let list = [];
    arrOfAssignments.forEach(assignment => list.push(new AssignmentView(assignment)));
    self.projectTitleText.text(projectName);
    self.projectList.append(list);
  };

  ProjectView.prototype.show = function () {
    let self = this;
    if (self.projectView) {
      self.projectView.show();
    }
  };

  ProjectView.prototype.hide = function () {
    let self = this;
    if (self.projectView) {
      self.projectView.hide();
    }
  };

  ProjectView.prototype.destroy = function () {
    this.remove();
  };

  return ProjectView;
}(View));
