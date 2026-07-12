# Invalid Mermaid

This fixture exercises graceful error handling (FR-8.3).

```mermaid
graph TD
    A -->
```

```mermaid
not a real diagram type
    foo bar baz
```
