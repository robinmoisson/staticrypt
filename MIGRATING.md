# Migration guide

## From 2.x to 3.x

StatiCrypt 3.x brings a number of improvements: strong default security with WebCrypto, cleaner CLI options and a much simpler `password_template`. This has been done while preserving auto-decrypt "share" links and remember-me functionality: if you used those with StatiCrypt 2.x, your links will still work with 3.x and you'll still be logged in.

There are a few breaking changes, but they should be easy to fix. If you have any trouble, feel free to open an issue.

### Breaking changes

3.x works with WebCrypto exclusively, which is only available on HTTPS and localhost. If you need access to the file over HTTP, you'll need to stay on 2.x.

The minimum node version is now 16. If you need to stay on a lower number, you'll need to stay on 2.x and use the cryptoJS engine.

#### The CLI

When encrypting `secret.html`, the CLI will now create a folder with your encrypted file `encrypted/secret.html`. It will not create a `secret_encrypted.html` file anymore.

Passwords shorter than 14 characters used to trigger a warning, now they trigger a blocking promp ("Do you want to use that password [yn]"). Add `--short` to hide that prompt.

The options and parameters have been changed:
- all template related options have been renamed to `--template-*`: pick your file with `--template`, set title with `--template-title`, etc.
- the password is now an optional argument: set with `-p <password>`, or leave blank to be prompted for it.
- many other options have been renamed, refer to the help (`--help`) or documentation for the full reference.

#### The password template

If you don't use a custom password template, you don't need to do anything. 

If you do, you need to update your template. To do so:
- get `lib/password_template.html`
- replace the javascript part from this file in your custom template (the new template is logic is much simpler)
- update the injected variables in your template (notice we use new template tags, they now are `/*[|variable|]*/0` instead of `{variable}`):
  - `{title}` => `/*[|template_title|]*/0`
  - `{instructions}` => `/*[|template_instructions|]*/0`
  - `{remember_me}` => `/*[|template_remember|]*/0`
  - `{passphrase_placeholder}` => `/*[|template_placeholder|]*/0`
  - `{decrypt_button}` => `/*[|template_button|]*/0`
