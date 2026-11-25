/**
 * Scopes (LANGUAGE.md §5.3).
 *
 * The rules that make this different from most environments:
 *
 * - Lookup is by **presence**, not truthiness. A variable holding `0`, `""`,
 *   `ሃሰት`, `[]` or `ምንም` is defined. v1-py used a falsy check here, which
 *   broke the counter idiom that opens three of its four examples
 *   (CHANGES C19).
 * - Assignment binds in the **current** scope. It rebinds a name already
 *   there, otherwise it creates one, and it never reaches up to rebind an
 *   outer variable. A function can read a global but not reassign it (§5.3).
 * - `ከሆነ` and `እስከሆነ ድረስ` blocks do **not** get a scope. Only a call does.
 * - A method's scope carries the object it was called on, so the object's
 *   attributes and methods are in scope by name, with no `self` (§7.6).
 */

import type { DeclaredType } from '../parser/index.js';
import type { ClassValue, ObjectValue, Value } from './values.js';

/** Where a name was found, which assignment needs to know. */
export type Binding =
  | { readonly where: 'scope'; readonly scope: Scope; readonly value: Value }
  | { readonly where: 'attribute'; readonly object: ObjectValue; readonly value: Value }
  | { readonly where: 'method'; readonly value: Value };

export class Scope {
  private readonly values = new Map<string, Value>();
  /** Types pinned by annotated declarations in this scope (§7.2). */
  private readonly types = new Map<string, DeclaredType>();

  constructor(
    readonly parent: Scope | null,
    /** Shown in tracebacks; the global scope is `ዋና ፕሮግራም` (§9.1). */
    readonly name: string,
    /**
     * The object whose method or constructor is running here, if any. Its
     * members resolve as plain names inside the body (§7.6).
     */
    readonly self: ObjectValue | null = null,
  ) {}

  /** A child scope for a call. */
  child(name: string, self: ObjectValue | null = null): Scope {
    return new Scope(this, name, self);
  }

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  /** Finds a name, saying where it lives, or null if it is not defined. */
  resolve(name: string): Binding | null {
    const own = this.values.get(name);
    if (own !== undefined || this.values.has(name)) {
      return { where: 'scope', scope: this, value: own as Value };
    }

    if (this.self !== null) {
      const attribute = this.self.attributes.get(name);
      if (attribute !== undefined || this.self.attributes.has(name)) {
        return { where: 'attribute', object: this.self, value: attribute as Value };
      }
      const method = findMethod(this.self, name);
      if (method !== null) return { where: 'method', value: method };
    }

    return this.parent?.resolve(name) ?? null;
  }

  /** The value of a name, or null if it is not defined. */
  get(name: string): Value | null {
    return this.resolve(name)?.value ?? null;
  }

  has(name: string): boolean {
    return this.resolve(name) !== null;
  }

  /** Whether this exact scope binds the name, ignoring parents and members. */
  hasOwn(name: string): boolean {
    return this.values.has(name);
  }

  /**
   * The names this exact scope binds, in the order they were defined.
   *
   * Used to find out what the standard library's prelude added to the globals,
   * so those names get the same shadowing error the host built-ins do (§8.2)
   * and so a test can check the library's documented surface against what it
   * actually defines.
   */
  ownNames(): readonly string[] {
    return [...this.values.keys()];
  }

  // -------------------------------------------------------------------------
  // Writing
  // -------------------------------------------------------------------------

  /** Binds a name in this scope, creating or rebinding it. */
  define(name: string, value: Value): void {
    this.values.set(name, value);
  }

  /** Records the type an annotated declaration pins to a name (§7.2). */
  pinType(name: string, type: DeclaredType): void {
    this.types.set(name, type);
  }

  /**
   * The type pinned to a name, looked up where the name is bound.
   *
   * An assignment is checked against the annotation from the declaration that
   * introduced the name, not from whatever scope is running.
   */
  declaredTypeOf(name: string): DeclaredType | null {
    if (this.values.has(name)) return this.types.get(name) ?? null;
    if (this.self !== null && this.self.attributes.has(name)) {
      return this.self.attributeTypes.get(name) ?? null;
    }
    return this.parent?.declaredTypeOf(name) ?? null;
  }

  // -------------------------------------------------------------------------
  // Tracebacks (§9.1)
  // -------------------------------------------------------------------------

  /** This scope's name and its ancestors', innermost first. */
  chain(): string[] {
    const names = [this.name];
    let next = this.parent;
    while (next !== null) {
      names.push(next.name);
      next = next.parent;
    }
    return names;
  }
}

/**
 * Finds a method on an object's class, then up the parent chain, and binds it
 * to the object.
 *
 * Resolution starts at the object's own class every time, which is what makes
 * dispatch dynamic: a method inherited from a parent that calls `ድምጽ()`
 * reaches the subclass's override (§7.6, CHANGES C18).
 */
export function findMethod(object: ObjectValue, name: string): Value | null {
  for (let cls: ClassValue | null = object.cls; cls !== null; cls = cls.parent) {
    const declaration = cls.methods.get(name);
    if (declaration !== undefined) {
      return {
        kind: 'function',
        name,
        params: declaration.params,
        body: declaration.body,
        closure: cls.scope,
        boundTo: object,
      };
    }
  }
  return null;
}
