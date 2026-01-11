/**
 * Framework exports and auto-registration
 */

// Base framework
export {
  Framework,
  BaseFramework,
  FrameworkRegistry,
  FrameworkContextFlags,
} from "./base-framework.js";

// Framework implementations
export { NestJSFramework } from "./nestjs.js";
export { NextJSFramework } from "./nextjs.js";
export { ReactFramework } from "./react.js";
export { ExpressFramework } from "./express.js";
export { VanillaFramework } from "./vanilla.js";

// Framework detector
export { FrameworkDetector } from "./detector.js";

// Import for auto-registration
import { FrameworkRegistry } from "./base-framework.js";
import { NestJSFramework } from "./nestjs.js";
import { NextJSFramework } from "./nextjs.js";
import { ReactFramework } from "./react.js";
import { ExpressFramework } from "./express.js";
import { VanillaFramework } from "./vanilla.js";

/**
 * Register all frameworks automatically
 */
export function registerAllFrameworks(): void {
  FrameworkRegistry.register(new NestJSFramework());
  FrameworkRegistry.register(new NextJSFramework());
  FrameworkRegistry.register(new ReactFramework());
  FrameworkRegistry.register(new ExpressFramework());
  FrameworkRegistry.register(new VanillaFramework());
}

// Auto-register on module load
registerAllFrameworks();
