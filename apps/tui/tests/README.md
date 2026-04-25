# Testing Guide

This document provides guidelines for writing and running tests in the ChatGPT Code TUI project.

## Running Tests

To run all tests, use the following command:

```bash
npm test
```

This command executes the test suite using [Jest](https://jestjs.io/).

## Test Structure

Tests are organized in the `tests/unit` directory, with each test file corresponding to a specific module or utility in the project. For example:

- `tests/unit/errorHandler.test.ts`: Tests for the `errorHandler` utility.
- `tests/unit/logger.test.ts`: Tests for the `logger` utility.
- `tests/unit/constants.test.ts`: Tests for the `constants` utility.
- `tests/unit/index.test.ts`: Tests for the `index` module.

## Writing Tests

When writing tests, follow these guidelines:

1. **Isolate Tests**: Each test should focus on a single functionality or behavior.
2. **Use Descriptive Names**: Test names should clearly describe the behavior being tested.
3. **Test Edge Cases**: Include tests for edge cases, such as invalid inputs or unexpected conditions.
4. **Mock External Dependencies**: Use mocking to isolate the code being tested from external dependencies.

### Example Test

Here’s an example of a test for the `validateWorkspaceRoot` function:

```typescript
// tests/unit/index.test.ts

describe("Index Utilities", () => {
  describe("validateWorkspaceRoot", () => {
    it("should not throw an error if workspaceRoot is a non-empty string", () => {
      expect(() => validateWorkspaceRoot("/valid/path")).not.toThrow();
    });

    it("should throw an error if workspaceRoot is an empty string", () => {
      expect(() => validateWorkspaceRoot("")).toThrow("Workspace root must be a non-empty string.");
    });
  });
});
```

## Test Coverage

To ensure high test coverage, run the following command to generate a coverage report:

```bash
npm test -- --coverage
```

This command generates a coverage report in the `coverage` directory, which you can open in your browser to review.

## Debugging Tests

If a test fails, you can debug it by running Jest in watch mode:

```bash
npm test -- --watch
```

This allows you to focus on specific tests or files and see the results in real-time as you make changes.

## Best Practices

- **Keep Tests Fast**: Avoid slow operations in tests, such as file I/O or network requests.
- **Avoid Test Pollution**: Ensure tests do not depend on shared state that could be modified by other tests.
- **Use Setup and Teardown**: Utilize Jest’s `beforeEach`, `afterEach`, `beforeAll`, and `afterAll` to manage test setup and cleanup.

## Contributing Tests

When contributing new features or bug fixes, ensure that:

1. New functionality is covered by tests.
2. All tests pass before submitting a pull request.
3. Test coverage is maintained or improved.

If you have any questions or need help writing tests, feel free to open an issue or ask in a pull request!