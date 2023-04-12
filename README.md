# StatiCrypt

**LEGACY VERSION - SUPPORT FOR 1.x HAS ENDED.** We recommend you switch to the latest version to get the latest security fixes. See [the migration guide](https://github.com/robinmoisson/staticrypt/blob/main/MIGRATING.md).

Based on the [crypto-js](https://github.com/brix/crypto-js) library, StatiCrypt uses AES-256 to encrypt your string with your passphrase in your browser (client side).

Download your encrypted string in a HTML page with a password prompt you can upload anywhere (see [example](https://robinmoisson.github.io/staticrypt/example.html)).

You can encrypt a file online at https://robinmoisson.github.io/staticrypt.

## HOW IT WORKS

StatiCrypt generates a static, password protected page that can be decrypted in-browser: just send or upload the generated page to a place serving static content (github pages, for example) and you're done: the javascript will prompt users for password, decrypt the page and load your HTML.

It basically encrypts your page and puts everything with a user-friendly way to use a password in the new file.

AES-256 is state of the art but brute-force/dictionary attacks would be trivial to do at a really fast pace: **use a long, unusual passphrase**.

**Disclaimer:** The concept is simple and should work ok but I am not a cryptographer, if you have sensitive banking or crypto data you might want to use something else. :)

You can report thoughts and issues to the [GitHub project](https://robinmoisson.github.io/staticrypt) but be warned I might be extremely slow to respond (though the community might help). If a serious security issue is reported I'll try to fix it quickly.

## CLI

Staticrypt is available through npm as a CLI, install with `npm install -g staticrypt` (with or without the `-g` flag) and use as follow:

    Usage: staticrypt <filename> <passphrase> [options]

    Options:
      --help                    Show help                                   [boolean]
      --version                 Show version number                         [boolean]
      -e, --embed               Whether or not to embed crypto-js in the page (or use 
                                an external CDN)
                                                           [boolean] [default: true]
      -o, --output              File name / path for generated encrypted file
                                                            [string] [default: null]
      -t, --title               Title for output HTML page
                                                [string] [default: "Protected Page"]
      -i, --instructions        Special instructions to display to the user.
                                                            [string] [default: null]
      -f, --file-template       Path to custom HTML template with password prompt.
                              [string] [default: "[...]/cli/password_template.html"]

Example usages:

- `staticrypt test.html mySecretPassphrase` -> creates a `test_encrypted.html` file
- `find . -type f -name "*.html" -exec staticrypt {} mypassword \;` -> create encrypted files for all HTML files in your directory

You can use a custom template for the password prompt - just copy `cli/password_template.html` and modify it to suit your presentation style and point to your template file with the `-f` flag. Be careful to not break the encrypting javascript part, the variables replaced by staticrypt are between curly brackets: `{instructions}`.

**ADBLOCKERS**: If you do not embed crypto-js and serve it from a CDN, some adblockers see the `crypto-js.min.js`, think that's a crypto miner and block it.

## Contribution

Thank you: [@AaronCoplan](https://github.com/AaronCoplan) for bringing the CLI to life

**Opening PRs:** You're free to open PRs if you're ok with having no response for a (very) long time and me ending up getting inspiration from your proposal but merging something different myself instead of your PR because of limited available time and lighter mental load (I'll try to credit you though). I still appreciate them but I'd rather be upfront about it, rather than waiting for a perfect occasion to manifest and never actually updating anything. Apologies in advance, and thank you!

If you find a serious security bug please open an issue, I'll try to fix it relatively quickly.

## Alternativs

https://github.com/MaxLaumeister/PageCrypt is a similar project (I think it predates staticrypt).

https://github.com/tarpdalton/staticrypt/tree/webcrypto is a fork that uses the WebCrypto browser api to encrypt and decrypt the page, which removes the need for `crypto-js`. There's a PR open which I haven't checked in detail yet. WebCrypto is [only available in HTTPS context](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) (which [is annoying people](https://github.com/w3c/webcrypto/issues/28)) so it won't work if you're on HTTP.
