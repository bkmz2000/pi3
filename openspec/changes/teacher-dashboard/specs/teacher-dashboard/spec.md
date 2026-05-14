# Teacher Dashboard - Specification

## Overview

The teacher dashboard provides a unified interface for teachers to manage groups, view student projects, and handle help requests.

## ADDED Requirements

### Requirement: Teacher dashboard shows help request notifications

The system SHALL display a notification badge in the dashboard header when there are pending help requests.

#### Scenario: Badge shows pending count
- **WHEN** teacher has pending help requests
- **THEN** dashboard header shows a badge with the count of pending requests

### Requirement: Teacher dashboard lists all student groups

The system SHALL display all groups the teacher manages with member counts.

#### Scenario: View groups list
- **WHEN** teacher opens dashboard and selects "Groups" section
- **THEN** system displays all groups with name and member count

### Requirement: Teacher dashboard shows student shared projects

The system SHALL display all projects shared by students in a card layout.

#### Scenario: View shared projects
- **WHEN** teacher opens dashboard and selects "Student Projects" section
- **THEN** system displays all shared student projects
- **AND** projects with pending help requests show a special indicator

### Requirement: Teacher can open student project for review

The system SHALL allow a teacher to click on a student's project and open it in a read-only view with comment capability.

#### Scenario: Open project for review
- **WHEN** teacher clicks "Review" on a student project card
- **THEN** system opens the project in read-only mode
- **AND** teacher can add comments to any line

### Requirement: Student sees "I need help" button

The system SHALL display a prominent "I need help" button in the IDE for students who have shared their project.

#### Scenario: Student sees help button
- **WHEN** student is working on a project that is shared with their teacher
- **THEN** IDE shows a "I need help" button
- **AND** clicking it creates a help request