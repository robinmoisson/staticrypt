# Usage: `npm run build`
# NPM establishes a reliable working directory

cd ..
# Copy files that should be included in `npm publish`
cp README.md LICENSE password_template.html cli/
# Encrypt the example file
npx ./cli example.html test \
    --no-embed \
    --salt b93bbaf35459951c47721d1f3eaeb5b9 \
    --instructions "Enter \"test\" to unlock the page"
