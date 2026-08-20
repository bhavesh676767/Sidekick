Sidekick

Sidekick is basically an AI assistant that lives inside your browser.

instead of opening ChatGPT, copying stuff from a website, pasting it, then going back and doing everything yourself, you can just tell Sidekick what you want and it tries to do it for you.

you can say things like:

* "summarize this page"
* "find the cheapest one"
* "fill this form"
* "search this"
* "open youtube"
* "scroll down"
* "click this"
* "compare these products"

Sidekick looks at the page your on, understands whats there, and uses browser actions to get the task done.

## how to use it

how to install it:

download the project and run:

```bash
npm install
npm run build
```

then go to:

`chrome://extensions`

turn on **Developer mode**, click **Load unpacked**, and select the `dist` folder.

Use ur own llm api key broski:

open the Sidekick extension.

go to **Settings** and add an API key for one of the supported AI providers.

you can also use **Ollama** if you want to run a model locally.

how to use it:

open any normal website and launch the Sidekick notch.

type what you want it to do.

thats basically it.

Sidekick reads the page, figures out what you mean and tries to do the actions for you.

## why i made it

i wanted the browser to feel more like something you can just talk to instead of something you have to keep clicking around in.

instead of:

**click → search → copy → paste → click → scroll → repeat**

you can just say:

**"find me the cheapest option and open it."**

and let Sidekick handle the boring part.

tech used:

built with React, Vite, Tailwind and Chrome Extension Manifest V3.

it also supports multiple AI providers and local Ollama.


## status

Sidekick currently works as an unpacked Chromium extension.

its still very much a work in progress. theres honestly **a lot of work left** to make it actually feel really smooth, reliable and likeable to use.

the basic idea and core stuff is there, but theres still alot i want to improve. i'll be working on that in the future and hopefully make it something that actually feels good to use.

for now its mostly just a project i wanted to build because i thought the idea was pretty cool lol.

its also not on the Chrome Web Store yet.

