# Usage: `npm run build`
# NPM establishes a reliable working directory

# Encrypt the example file
npx . example/example.html test \
    --no-embed \
    --salt b93bbaf35459951c47721d1f3eaeb5b9 \
    --instructions "Enter \"test\" to unlock the page"
