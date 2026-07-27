# Crafter CLI

Commandline interface to CrafterCMS. Learn more at https://craftercms.com/docs.

# Examples

The first command needed to work with this tool is `add-environment`, you need to provide a name, the url for a
CrafterCMS authoring server and the authentication information:

`crafter-cli add-environment -e local -u http://localhost:8080 --username john --password --generate-token`

Once the environment has been added, you can create projects and sync a remote repository:

`crafter-cli create-site -e local -s editorial --blueprint org.craftercms.blueprint.editorial`

`crafter-cli add-remote -e local -s editorial -n origin -u http://github.com/john.doe/editorial.git`

`crafter-cli sync-to -e local -s editorial -n origin -b site-updates`

It is also possible to create a project from a remote repository and later sync it:

```
crafter-cli create-site -e local -s my-site -sn 'My Site' \
                        -u http://github.com/john/doe/my-site.git -b development \
                        --username john --key /home/john/private_key
```

`crafter-cli sync-from -e local -s editorial -n origin`

To create a group:

`crafter-cli create-group -e local -gn test-group -gd "Description of the group"`

You can bulk import groups by providing a CSV file with the format: `group name, group description`:

`crafter-cli create-group -e local -gi /path/to/group.csv`

You can publish content to the Live or Staging targets (Staging must be enabled to publish to it):

`crafter-cli publish-content -e local -s editorial --publishingTarget live --items "/site/website/index.xml" --title "Publish live" --comment "Publish live comment"`

`crafter-cli publish-content -e local -s editorial --publishingTarget staging --items "/site/website/index.xml" --title "Publish staging" --comment "Publish staging comment"`

To publish multiple items, separate them by a comma:

`crafter-cli publish-content -e local -s editorial --publishingTarget live --items "/site/website/index.xml,/site/website/health/index.xml" --title "Publish multiple items" --comment "Publish multiple items comment"`

You can schedule content to be published:

`crafter-cli publish-content -e local -s editorial --publishingTarget live --items "/site/website/index.xml" --schedule "2025-10-31T01:30:00.000-05:00" --title "Publish Schedule" --comment "My comment"`

For a detailed list of commands & arguments run `crafter-cli help`

# Community

## Contributors

https://github.com/craftersoftware/craftercms/blob/develop/CONTRIBUTORS.md

## Code of Conduct

https://github.com/craftersoftware/craftercms/blob/develop/CODE_OF_CONDUCT.md

## Contributing

https://github.com/craftersoftware/craftercms/blob/develop/CONTRIBUTING.md

## Git Workflow

https://github.com/craftersoftware/craftercms/blob/develop/GIT_WORKFLOW.md
