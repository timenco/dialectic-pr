import { FrameworkName } from "../core/types.js";
import { Framework, FrameworkRegistry } from "./base-framework.js";

/**
 * Framework Service Interface
 * core/ 및 false-positive/ 모듈이 FrameworkRegistry 정적 클래스에 직접 의존하지 않도록
 * 인터페이스를 통해 간접 접근합니다.
 */
export interface IFrameworkService {
  getFramework(name: FrameworkName): Framework | undefined;
}

/**
 * Framework Service
 * FrameworkRegistry를 래핑하는 기본 구현체
 */
export class FrameworkService implements IFrameworkService {
  getFramework(name: FrameworkName): Framework | undefined {
    return FrameworkRegistry.get(name);
  }
}
