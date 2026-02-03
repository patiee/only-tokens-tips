# Only Tokens Tips

## Short Description
Cross-chain tips in crypto for streamers with interactive TTS


## Project Description

OnlyTokens Tips redefines the way streamers connect with their audience by unlocking the power of cross-chain crypto tipping. We empower content creators to accept contributions in any token from any blockchain, removing the friction of wallet compatibility for viewers. The platform works instantly: simply connect your wallet, choose your asset, and tip. 

For streamers, we provide a fully customizable, interactive notification widget designed for seamless integration with OBS and Streamlabs. This widget features real-time alerts and built-in Text-to-Speech (TTS) functionality, allowing donor messages to be read aloud live on stream to maximize engagement. To sustain this service, a small 1% platform fee is applied to transactions, ensuring high-uptime bridging and notification services.

## How it's made

OnlyTokens Tips is engineered for performance and scalability, leveraging a modern tech stack to handle real-time value transfer. The frontend is built with Next.js and Tailwind CSS for a responsive, high-fidelity user experience. The backend, written in Go (Golang), orchestrates secure user authentication, registration, and manages the high-concurrency WebSocket connections required for instant tip notifications on the widget.

The backbone of our cross-chain capabilities is the **LI.FI API**, which we utilize as a powerful **Composer** to aggregate and structure complex cross-chain routes. Instead of a pre-built widget, we implemented a custom UI that interacts directly with LI.FI to compose the perfect transaction path—handling bridging, swapping, and our 1% platform fee in a single atomic flow. This "Composer" functionality enables us to find the most efficient route across the ecosystem while maintaining total control over the user experience.
