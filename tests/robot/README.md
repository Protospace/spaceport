# Spaceport Robot Framework Tests

This directory contains an initial Robot Framework test scaffold for the Spaceport portal using the Browser library.

## Scope

This first PR focuses on:
- local Browser-library test setup
- shared Robot resources for navigation, waits, assertions, and screenshots
- page resources for the public landing page and public messaging area
- one smoke suite covering core public-page rendering checks and basic navigation
- helper Python libraries for Faker-based test data and CSV-driven expansion in later PRs

## Layout

- `tests/robot/pages/` page resources
- `tests/robot/resources/` shared Robot keywords, variables, and Python helper libraries
- `tests/robot/tests/` Robot suites
- `results/` local execution output

## Requirements

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r tests/robot/requirements.txt
rfbrowser init
```

## Running tests

```bash
robot -d results tests/robot/tests
robot -d results -i smoke tests/robot/tests
robot -d results tests/robot/tests/smoke.robot
```

## Notes

- The suite currently targets a local Spaceport instance at `http://localhost:3000`.
- This PR is intentionally limited to smoke coverage and reusable test infrastructure.
- Login, signup, CSV-driven suites, and broader regression coverage can follow in later PRs.

## Reliability notes

Some public-page controls still require position-based selectors, especially in the messaging area. Adding stable `data-testid` attributes in the app would make these tests more robust.
