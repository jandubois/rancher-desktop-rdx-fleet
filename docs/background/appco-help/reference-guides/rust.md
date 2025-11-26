---
description: Learn how to install and use Rust
lang: en
robots: index, follow
title: Rust \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Rust
twitter:title: Rust
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Rust


# Rust


Learn how to install and use Rust


![Rust Logo](images/reference-guides/logo-rust.png "Rust Logo")

## Get started

The [Rust](https://apps.rancher.io/applications/rust) programming language helps you write faster, more reliable software. High-level ergonomics and low-level control are often at odds in programming language design; Rust challenges that conflict. Through balancing powerful technical capacity and a great developer experience, Rust gives you the option to control low-level details (such as memory usage) without all the hassle traditionally associated with such control.

Before exploring the container’s possibilities, let’s start by deploying the default configuration:


```
docker run \
    --interactive \
    --tty \
    --rm \
    --name <container-name> \
    dp.apps.rancher.io/containers/rust:1.90.0
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Docker client.

## Container overview

Our container is based on the official [Rust](https://github.com/rust-lang/docker-rust/blob/master/stable/trixie/Dockerfile) container and adapted to include our best practices. As such, any container-related documentation provided by upstream will work out of the box with our container. You can check the official documentation [here](https://github.com/docker-library/docs/tree/master/rust).

### Flavors

The container image is provided in the following flavors:

- Default flavor: This flavor of the container image is based on SUSE Linux BCI Micro base image and includes only the essential system packages **to run Rust and build applications**. Therefore, it lacks the package manager and various popular build tools such as `curl`, `find` or `grep`. It is ideal if you are looking for a minimal image to build your Rust application.
- Development flavor `dev`: This flavor is based on SUSE Linux BCI Base and includes the `zypper` package manager, the `rpm` packaging tool, and various different build tools such as `curl`, `find`, `grep`. Therefore, it is ideal for build pipelines that need extra programs **to build your application**.

## Container configuration

The Rust container, like the official container images, does not specify any entrypoint to run the container image. It is up to the end user to run any specific programs within the container image. The following environment variables are available:

- `CARGO_HOME` set to `/usr/share/cargo`. This directory is writable and it is used to download and cache dependencies.
- `PATH` set to `$CARGO_HOME/bin:$PATH`. It allows to have installed binary crates available in the system’s `PATH`.

## Container usage

We will describe how you can use the Rust container image to compile a simple program, and how you can create a new container image with the resulting binaries.

## Build a Rust program

The example below (`main.rs`) shows the traditional “Hello, World!” program, that just prints a message to standard output:


```
fn main() {
    println!("Hello, world!");
}
```


To compile and execute it within the Rust container, run the commands below:


```
$ mkdir /tmp/hello_world
$ cd /tmp/hello_world
$ cat >main.rs <<EOF
fn main() {
    println!("Hello, world!");
}
EOF
$ rustc main.rs
$ ./main
Hello, world!
```


## Build a Rust package

Although compiling simple programs with `rustc` is fine, it is common to structure your programs as packages and manage them with the `cargo` utility. The steps below show how to do so within the Rust container:


```
$ mkdir /tmp/hello_world
$ cd /tmp/hello_world
$ cargo init
    Creating binary (application) package
$ cargo build
   Compiling hello_world v0.1.0 (/tmp/hello_world)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.16s
$ cargo run
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.00s
     Running `target/debug/hello_world`
Hello, world!
```


## Bundle a Rust program into a container image

An efficient way to compile and bundle Rust programs into a container image is defining a [multi-stage](https://docs.docker.com/build/building/multi-stage/) `Dockerfile`. The program is compiled in the `builder` stage, then the resulting binary is packaged in a minimal image:


```
FROM dp.apps.rancher.io/containers/rust:1.90.0 AS builder
WORKDIR /tmp/hello_world
RUN cargo init
# The `--release` flag compiles with optimizations
RUN cargo build --release

FROM dp.apps.rancher.io/containers/bci-micro:15.7
COPY --from=builder /tmp/hello_world/target/release/hello_world /usr/bin/hello_world
CMD ["hello_world"]
```


In the same directory where the `Dockerfile` is located, execute the commands below to build and run the container image:


```
$ docker build -t hello_world .
$ docker run hello_world
Hello, world!
```


Last modified November 17, 2025


