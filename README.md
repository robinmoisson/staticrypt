# StatiCrypt

Based on the [crypto-js](https://github.com/brix/crypto-js) library, StatiCrypt uses AES-256 to encrypt your string with your passphrase in your browser (client side).

Download your encrypted string in a HTML page with a password prompt you can upload anywhere (see [example](https://robinmoisson.github.io/staticrypt/example.html)).

You can encrypt a file online at https://robinmoisson.github.io/staticrypt.

## HOW IT WORKS

**Disclaimer** if you have extra sensitive banking data you should probably use something else!

StatiCrypt generates a static, password protected page that can be decrypted in-browser: just send or upload the generated page to a place serving static content (github pages, for example) and you're done: the javascript will prompt users for password, decrypt the page and load your HTML.

It basically encrypts your page and puts everything with a user-friendly way to use a password in the new file.

AES-256 is state of the art but brute-force/dictionary attacks would be trivial to do at a really fast pace: **use a long, unusual passphrase**.

The concept is simple but I am not a cryptographer, feel free to contribute or report any thought to the GitHub project! (Though be warned it might take me a long time to get to it - I apologize in advance)

Similar project: [MaxLaumeister/clientside-html-password](https://github.com/MaxLaumeister/clientside-html-password)

## CLI

Staticrypt is available through npm as a CLI, install with `npm install -g staticrypt` and use as follow:

    Usage: staticrypt <filename> <passphrase> [options]

    Options:
      --help               Show help                                       [boolean]
      --version            Show version number                             [boolean]
      -e, --embed          Whether or not to embed crypto-js in the page (or use an
                           external CDN)                   [boolean] [default: true]
      -o, --output         File name / path for generated encrypted file
                                                            [string] [default: null]
      -t, --title          Title for output HTML page
                                                [string] [default: "Protected Page"]
      -i, --instructions   Special instructions to display to the user.
                                                            [string] [default: null]
      -f, --file-template  Path to custom HTML template with password prompt.
                              [string] [default: "[...]/cli/password_template.html"]


Example usages:

- `staticrypt test.html mysecretpassword` -> creates a `test_encrypted.html` file
- `find . -type f -name "*.html" -exec staticrypt {} mypassword \;` -> create encrypted files for all HTML files in your directory

You can use a custom template for the password prompt - just copy `cli/password_template.html` and modify it to suit your presentation style and point to your template file with the `-f` flag. Be careful to not break the encrypting javascript part, the variables replaced by staticrypt are between curly brackets: `{instructions}`.

**ADBLOCKERS**: If you do not embed crypto-js and serve it from a CDN, some adblockers see the `crypto-js.min.js`, think that's a crypto miner and block it.

Thanks [Aaron Coplan](https://github.com/AaronCoplan) for bringing the CLI to life!
