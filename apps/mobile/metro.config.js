// Yarn Berry 모노레포에서 Metro가 워크스페이스 루트의 node_modules까지 해석하도록 설정.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// @pitches/shared 는 API(NodeNext) 규칙대로 "./schemas.js" 처럼 .js 확장자로 .ts 를 import 한다.
// Metro 는 이 매핑을 모르므로 상대경로 .js 를 못 찾으면 .ts 로 다시 시도한다.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(context, moduleName, platform);
    } catch {
      return context.resolveRequest(context, moduleName.replace(/\.js$/, ".ts"), platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
