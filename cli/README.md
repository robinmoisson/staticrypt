# StatiCrypt

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
          --help                    Show help                              [boolean]
          --version                 Show version number                    [boolean]
      -e, --embed                   Whether or not to embed crypto-js in the page
                                    (or use an external CDN).
                                                           [boolean] [default: true]
      -o, --output                  File name / path for generated encrypted file.
                                                            [string] [default: null]
      -t, --title                   Title for output HTML page.
                                                [string] [default: "Protected Page"]
      -i, --instructions            Special instructions to display to the user.
                                                              [string] [default: ""]
      -f, --file-template           Path to custom HTML template with passphrase
                                    prompt.
                                      [string] [default: "./password_template.html"]
      -r, --remember                Expiration in days of the "Remember me" checkbox
                                    that will save the (salted + hashed) passphrase
                                    in localStorage when entered by the user.
                                    Default: "0", no expiration.
                                                               [number] [default: 0]
          --noremember              Set this flag to remove the "Remember me"
                                    checkbox.             [boolean] [default: false]
          --remember-label          Label to use for the "Remember me" checkbox.
                                                   [string] [default: "Remember me"]
          --passphrase-placeholder  Placeholder to use for the passphrase input.
                                                    [string] [default: "Passphrase"]
      -s, --salt                    Set the salt manually. It should be set if you
                                    want use "Remember me" through multiple pages.
                                    It needs to be a 32 character long hexadecimal
                                    string.
                                    Include the empty flag to generate a random salt
                                    you can use: "statycrypt -s".           [string]
          --decrypt-button          Label to use for the decrypt button. Default:
                                    "DECRYPT".         [string] [default: "DECRYPT"]


### Example usages

Encrypt `test.html` and create a `test_encrypted.html` file (add `-o my_encrypted_file.html` to change the name of the output file):

```
staticrypt test.html MY_PASSPHRASE
```

Encrypt all html files in a directory except the ones ending in `_encrypted.html`:

```
find . -type f -name "*.html" -not -name "*_encrypted.html" -exec staticrypt {} MY_PASSPHRASE -s MY_SALT \;
```

Replace `MY_PASSPHRASE` with a secure passphrase, and `MY_SALT` with a random 32 character long hexadecimal string (it should look like this `c5bcf27cc5e5bb1ecbc41f3da4470dea`, you can generate one with `staticrypt -s` or `staticrypt --salt`). The salt parameter is required if you want to have the same "Remember me" checkbox work on all pages, see detail in the corresponding section of this doc.

### "Remember me" checkbox

By default, the CLI will add a "Remember me" checkbox on the password prompt. If checked, when the user enters their passphrase its salted hashed value will be stored in localStorage. In case this value becomes compromised an attacker can decrypt the page, but this should hopefully protect against password reuse attack (of course please use a unique passphrase nonetheless).

This allows encrypting multiple page on a single domain with the same password: if you check "Remember me", you'll have to enter you password once then all the pages on that domain will automatically decrypt their content.

If no value is provided the stored passphrase doesn't expire, you can also give it a value in days for how long should the store value be kept with `-r NUMBER_OF_DAYS`. If the user reconnects to the page after the expiration date the store value will be cleared.

You can clear the values in localStorage (effectively "login out") at any time by appending `staticrypt_logout` to the URL query paramets (`mysite.com?staticrypt_logout`).

#### Encrypting multiple pages

If you want to encrypt multiple pages and have the "Remember me" checkbox work for all pages (so you have to enter your password on one page and then all other pages are automatically decrypted), you need to pass a `--salt MY_SALT` argument with the same salt for all encrypted pages. The salt isn't secret, so you don't have to worry about hiding it in the command prompt.

Because the hashed value is stored in the browser's localStorage, this will only work if all the pages are on the same domain name.

## FAQ

### Can I customize the password prompt?

Yes! Just copy `cli/password_template.html`, modify it to suit your style and point to your template file with the `-f path/to/my/file.html` flag. Be careful to not break the encrypting javascript part, the variables replaced by staticrypt are between curly brackets: `{salt}`.

### Can I prevent the "Remember me" checkbox?

If you don't want the checkbox to be included, you can add the `--noremember` flag to disable it.

### Why do we embed the whole crypto-js library in each encrypted file by default?

Some adblockers used to see the `crypto-js.min.js` served by CDN, think that's a crypto miner and block it. If you don't want to include it and serve from a CDN instead, you can add `--embed false`.

## 🙏 Contribution

Thank you: [@AaronCoplan](https://github.com/AaronCoplan) for bringing the CLI to life, [@epicfaace](https://github.com/epicfaace) & [@thomasmarr](https://github.com/thomasmarr) for sparking the caching of the passphrase in localStorage (allowing the "Remember me" checkbox)

**Opening PRs:** You're free to open PRs if you're ok with having no response for a (possibly very) long time and me possibly ending up getting inspiration from your proposal but merging something different myself (I'll try to credit you though). Apologies in advance for the delay, and thank you!

If you find a serious security bug please open an issue, I'll try to fix it relatively quickly.

## Alternatives

https://github.com/MaxLaumeister/PageCrypt is a similar project (I think it predates staticrypt).

https://github.com/tarpdalton/staticrypt/tree/webcrypto is a fork that uses the WebCrypto browser api to encrypt and decrypt the page, which removes the need for `crypto-js`. There's a PR open towards here which I haven't checked in detail yet. WebCrypto is only available in HTTPS context (which [is annoying people](https://github.com/w3c/webcrypto/issues/28)) so it won't work if you're on HTTP.
