Overview of the Extensions SDK


The resources in this section help you create your own Docker extension.

The Docker CLI tool provides a set of commands to help you build and publish your extension, packaged as a 
specially formatted Docker image.

At the root of the image filesystem is a `metadata.json` file which describes the content of the extension. 
It's a fundamental element of a Docker extension.

An extension can contain a UI part and backend parts that run either on the host or in the Desktop virtual machine.
For further information, see [Architecture](./extensions-sdk/architecture.md).

You distribute extensions through Docker Hub. However, you can develop them locally without the need to push 
the extension to Docker Hub. See [Extensions distribution](./extensions-sdk/extensions/DISTRIBUTION.md) for further details.

{{% include "extensions-form.md" %}}

{{< grid >}}



- [The build and publish process](./extensions-sdk/process.md)

- [Quickstart](./extensions-sdk/quickstart.md)

- [Part one: Build](./extensions-sdk/build.md)

- [Part two: Publish](./extensions-sdk/extensions.md)

- [Extension architecture](./extensions-sdk/architecture.md)

- [UI styling overview for Docker extensions](./extensions-sdk/design.md)

- [Developer Guides](./extensions-sdk/guides.md)

- [Developer SDK tools](./extensions-sdk/dev.md)
