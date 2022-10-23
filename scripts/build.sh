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
# Inline www dependencies using staticrypt's internal template expansion.
# Input file and salt are unused, but required.
npx . example/example.html test \
    --no-embed \
    --file-template lib/index_template.html \
    --output index.html \
    --salt b93bbaf35459951c47721d1f3eaeb5b9 \
