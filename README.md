# openinapp-challenge
a Node.js based app that is able to respond to emails sent to your Gmail mailbox while you’re out on a vacation.


# Introduction
This Node.js application leverages the Gmail API to automate various tasks within a Gmail account. It offers functionalities to manage emails, threads, and labels using Google's official googleapis library and OAuth 2.0 for authentication.


## 🚀 Features
- List existing labels, create new labels, and apply labels to specific threads.
- Identify threads based on various conditions, check for replies, and send replies automatically.
- Runs recurring processes to handle specific tasks at random intervals.
- Implements secure authentication to access Gmail data with user consent.

## How it Works

1. **Authentication**: Users are authenticated using OAuth 2.0 to access their Gmail accounts securely.
2. **Label Operations**: Provides label-related operations such as listing, creating, and applying labels to threads.
3. **Thread Automation**: Identifies threads based on criteria, checks for previous replies, and sends replies when necessary.
4. **Recurring Processes**: Executes automated tasks at random intervals using setTimeout for continuous operations.

## Technologies Used

* Node.js: Runtime environment for executing JavaScript code.
* Google APIs: Utilizes the Gmail API (v1) via the googleapis library for Gmail-related tasks.
* OAuth 2.0: Implements secure authentication and authorization for accessing Gmail accounts.
* File System (fs): Handles file-related operations for storing token and credential data.

## Getting Started

1. Clone the repository.
2. Install dependencies using `npm install`.
3. Setup OAuth 2.0 credentials and configure credentials.json.
4. Run the app using node index.js and follow on-screen instructions.