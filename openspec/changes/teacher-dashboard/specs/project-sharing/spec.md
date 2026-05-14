# Project Sharing with Teachers - Specification

## Overview

Students can share their projects with their teacher, making them visible in the teacher dashboard.

## ADDED Requirements

### Requirement: Student can share project with their teacher

The system SHALL allow a student to share a project with their assigned teacher.

#### Scenario: Share project with teacher
- **WHEN** student clicks "Share with Teacher" on a project
- **THEN** system shares the project with the student's teacher
- **AND** system marks the project as "shared_for_review"

#### Scenario: Unshare project from teacher
- **WHEN** student clicks "Unshare" on an already shared project
- **THEN** system removes the teacher's access to the project

### Requirement: Teacher can view student shared projects

The system SHALL display all projects shared by students in the teacher dashboard.

#### Scenario: Teacher sees shared projects
- **WHEN** teacher opens dashboard
- **THEN** system displays all projects shared with the teacher by their students

### Requirement: Teacher can open student project

The system SHALL allow a teacher to open and view any project shared with them.

#### Scenario: Open shared project
- **WHEN** teacher clicks "Open" on a student's shared project
- **THEN** system opens the project in read-only mode for the teacher