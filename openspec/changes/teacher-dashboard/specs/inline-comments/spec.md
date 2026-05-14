# Inline Comments - Specification

## Overview

Teachers can add comments to specific lines of student code in shared projects.

## ADDED Requirements

### Requirement: Teacher can add a comment to a line

The system SHALL allow a teacher to click on any line in a student's project and add a comment.

#### Scenario: Add comment to line
- **WHEN** teacher clicks on a line number in student code
- **AND** enters comment text
- **AND** submits
- **THEN** system stores the comment with line number and file path
- **AND** comment appears visually attached to that line

### Requirement: Teacher can view comments on a file

The system SHALL display all comments on a file, showing which lines they reference.

#### Scenario: View comments in file
- **WHEN** teacher opens a student's file
- **THEN** system highlights lines with existing comments
- **AND** displays comment indicators in the gutter

### Requirement: Teacher can delete their comment

The system SHALL allow a teacher to delete their own comments.

#### Scenario: Delete comment
- **WHEN** teacher clicks delete on their comment
- **THEN** system removes the comment

### Requirement: Comments persist across file edits

The system SHALL attempt to keep comments anchored to the intended code even after the student edits the file.

#### Scenario: Comment stays anchored after edit
- **WHEN** student edits a file (adds/removes lines)
- **AND** a comment existed on a line that is now shifted
- **THEN** system displays the comment on the first line containing the original anchor text