# Contributing to pc2e-pii-shield

We welcome contributions to help improve the security, performance, and features of the PII Shield Database MCP Server!

## How to Contribute

1.  **Fork the Repository:** Create a personal fork on GitHub.
2.  **Clone Locally:** Clone your fork to your workstation.
3.  **Create a Branch:** Create a feature branch describing your work:
    ```bash
    git checkout -b feature/your-feature-name
    ```
4.  **Implement Changes:** 
    *   Write clean, well-structured TypeScript code.
    *   Maintain the security boundaries (such as query sanitization and data masking).
    *   Ensure all new features include unit/integration tests.
5.  **Run Tests:** Validate your changes using our testing framework:
    ```bash
    npm run test
    ```
6.  **Commit Code:** Commit changes with descriptive, clear commit messages.
7.  **Submit a Pull Request (PR):** Target the `main` branch of the upstream repository. Explain your changes, the rationale behind your design decisions, and include any verification logs in your PR description.

## Code of Conduct

By participating in this project, you agree to adhere to the standard project Code of Conduct. Please treat all contributors with respect.
