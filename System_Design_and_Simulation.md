# Part 3: System Design and Simulation

This document contains a structured and improved transcript of a conversation about designing and simulating the previously discussed systems.

## Key Concepts

*   **Imperative Scenarios:** Writing simulation scenarios in a straightforward, command-like manner (e.g., `server.receive(client, data)`).
*   **Asynchronicity:** The nature of the system where inputs can arrive at any time and are processed in order.
*   **Input as Transaction:** Every input to a sub-machine is essentially a transaction on that machine.

## Conversation Transcript

**Speaker 1:** How would you properly simulate a random input?

**Speaker 2:** Why random? You can just write an imperative scenario, like a script: `server.receive(client, data)`.

**Speaker 1:** I was thinking of having a process running and then sending requests to it from the outside.

**Speaker 2:** You can do that within the same file, or a separate scenario file. You could have a simple server with sockets.

**Speaker 1:** I feel a bit of discomfort because I don't feel the asynchronicity when I write it all in one file.

**Speaker 2:** There is no asynchronicity in that sense; it's all synchronous. The system itself is asynchronous, but the simulation can be written synchronously. All inputs arrive and are placed in an "in-pool" in order.

**Speaker 1:** I see. So, the server is running, and when an input comes in, it's processed.

**Speaker 2:** Exactly. An input to an entity is, in effect, a server transaction. Any input to a sub-machine is a transaction on that machine.
