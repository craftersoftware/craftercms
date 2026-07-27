groovy-sandbox
==============

Compile-time transformer to run Groovy code in a restrictive sandbox. Executes untrusted Groovy script safely.

[Documentation](http://groovy-sandbox.kohsuke.org/).

#### Maven dependency

```xml
<dependency>
    <groupId>org.kohsuke</groupId>
    <artifactId>groovy-sandbox</artifactId>
    <version>1.25</version>
</dependency>
```

Starting with version 1.20, this artifact is only published to the Jenkins Releases repository, not to Maven Central as was done previously. Here are the details for the Jenkins Releases repository:

```xml
<repository>
  <id>jenkins-releases</id>
  <name>Jenkins Releases</name>
  <url>https://repo.jenkins-ci.org/releases/</url>
</repository>
```

#### Usage

A good example can be found [here](https://github.com/jenkinsci/groovy-sandbox/tree/master/src/test/groovy/org/kohsuke/groovy/sandbox/robot).
This is a simple test that always expects a `SecurityException`:

```groovy
class Test {
    static class DenyAll extends GroovyValueFilter {
        Object filter(Object o) { throw new SecurityException('Denied!') }
    }
    @Test(expected = SecurityException)
    void testScript() {
        final sh = new GroovyShell(new CompilerConfiguration()
                .addCompilationCustomizers(new SandboxTransformer()))
        new DenyAll().register()
        sh.evaluate('println hi')
    }
}
```

# Community

## Contributors

https://github.com/craftersoftware/craftercms/blob/develop/CONTRIBUTORS.md

## Code of Conduct

https://github.com/craftersoftware/craftercms/blob/develop/CODE_OF_CONDUCT.md

## Contributing

https://github.com/craftersoftware/craftercms/blob/develop/CONTRIBUTING.md

## Git Workflow

https://github.com/craftersoftware/craftercms/blob/develop/GIT_WORKFLOW.md