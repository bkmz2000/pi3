# Group Management - Specification

## Overview

Teachers can create groups, invite students by email, and manage group membership.

## ADDED Requirements

### Requirement: Teacher can create a group

The system SHALL allow a teacher to create a new group with a name. The group is associated with the creating teacher.

#### Scenario: Create group successfully
- **WHEN** teacher enters group name and submits
- **THEN** system creates a new group record and returns the group data

#### Scenario: Create group without name
- **WHEN** teacher submits empty group name
- **THEN** system returns a validation error

### Requirement: Teacher can invite students by email

The system SHALL allow a teacher to invite a student to a group by providing the student's email address.

#### Scenario: Invite existing user
- **WHEN** teacher enters an email that matches an existing user and submits
- **THEN** system adds the user to the group as a student member
- **AND** system sends no notification (user sees group on login)

#### Scenario: Invite non-existent email
- **WHEN** teacher enters an email that does not match any existing user
- **THEN** system returns an error indicating the user was not found

### Requirement: Teacher can view their groups

The system SHALL display a list of groups the teacher manages, including member count.

#### Scenario: List groups
- **WHEN** teacher opens group management page
- **THEN** system displays all groups the teacher created

### Requirement: Teacher can remove students from group

The system SHALL allow a teacher to remove a student from their group.

#### Scenario: Remove student
- **WHEN** teacher clicks remove on a student member
- **THEN** system removes the member from the group

### Requirement: Student can view their groups

The system SHALL display groups a student has been invited to.

#### Scenario: Student sees group invitation
- **WHEN** student opens groups page
- **THEN** system displays all groups the student is a member of