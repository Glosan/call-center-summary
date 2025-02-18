# Call Center Communication Summary Handler

This project is designed to handle and summarize all communication between customers and the call center. It captures communication from various sources, including Daktela (emails, calls) and AMIO chats, transcribes the calls, and uses ChatGPT to generate summaries, topics, and resolution statuses. The results are then saved to a database.

## Features

- **Capture Communication**: Automatically captures communication from:
  - **Daktela**: Emails and calls.
  - **AMIO Chats**: Periodically retrieves chat data.
  
- **Transcription**: Uses a transcription service to convert call audio into text.

- **Summarization**: Sends transcribed text to ChatGPT to generate:
  - **Summary**: A concise summary of the communication.
  - **Topic**: The main topic discussed.
  - **IsResolved**: Whether the issue was resolved.

- **Database Storage**: Saves the summarized data to a database for future reference and analysis.
