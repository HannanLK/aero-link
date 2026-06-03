// Ambient shim for the optional native `canvas` dependency.
// `canvas` is an optionalDependency (it fails to install on some platforms,
// e.g. Windows dev machines). This lets `tsc` build the Lambda locally even
// when canvas isn't present; the real module is used at runtime in the Lambda
// image where canvas is installed.
declare module 'canvas';
