# Usage: `npm run build`
# NPM establishes a reliable working directory

#
# Example
#
npx . example/example.html test \
    --no-embed \
    --salt b93bbaf35459951c47721d1f3eaeb5b9 \
    --instructions "Enter \"test\" to unlock the page"


#
# WWW
#
rm -r www-out
mkdir www-out
# Inline www dependencies.
# Input file and salt are unused, but required.
npx . example/example.html test \
    --no-embed \
    --file-template www/index_template.html \
    --output www-out/index.html \
    --salt b93bbaf35459951c47721d1f3eaeb5b9 \

cp lib/password_template.html www/*.js www-out/
