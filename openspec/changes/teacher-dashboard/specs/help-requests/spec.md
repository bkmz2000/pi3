# Help Requests - Specification

## Overview

Students can request help from their teacher, creating a notification that appears in the teacher's dashboard.

## ADDED Requirements

### Requirement: Student can request help on a project

The system SHALL allow a student to click "I need help" on a shared project, creating a help request for their teacher.

#### Scenario: Request help
- **WHEN** student clicks "I need help" button on their project
- **THEN** system creates a help_request record linking student, project, teacher
- **AND** student sees a "Help requested" badge on the project
- **AND** teacher's dashboard shows a pending help request indicator

### Requirement: Teacher can see pending help requests

The system SHALL display all pending help requests in the teacher dashboard with student name, project name, and timestamp.

#### Scenario: View help requests
- **WHEN** teacher opens their dashboard
- **THEN** system displays all pending help requests
- **AND** requests are sorted by creation time (newest first)

### Requirement: Student can cancel help request

The system SHALL allow a student to cancel their help request if they no longer need assistance.

#### Scenario: Cancel help request
- **WHEN** student clicks "Cancel help request" on their project
- **THEN** system marks the help_request as cancelled
- **AND** "Help requested" badge is removed
- **AND** teacher no longer sees this request in their dashboard

### Requirement: Teacher can mark help request as addressed

The system SHALL allow a teacher to mark a help request as addressed once they've helped the student.

#### Scenario: Mark as addressed
- **WHEN** teacher clicks "Addressed" on a help request
- **THEN** system marks the help_request as addressed
- **AND** request moves to history (not shown in pending)