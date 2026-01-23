type DeleteResourceFn = (resourceId: string) => Promise<void> | void;
export type ResourceManagerLogger = (...args: string[]) => void;

const DEFAULT_LOGGER: ResourceManagerLogger = (...args: string[]) => {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[resourcing:@sideweb:resource-handle]', ...args);
  }
};

const isManagedResourceId = (resourceId: string): boolean =>
  typeof resourceId === 'string' && resourceId.startsWith('uxp://');

class ResourceHandleCore {
  readonly resourceId: string;
  private retainCount = 0;
  private handleCount = 0;
  private disposed = false;
  private deleting = false;

  constructor(resourceId: string) {
    this.resourceId = resourceId;
  }

  attachHandle(): void {
    if (this.disposed) return;
    this.handleCount += 1;
  }

  detachHandle(): void {
    if (this.disposed) return;
    if (this.handleCount > 0) {
      this.handleCount -= 1;
    }
  }

  retain(): void {
    if (this.disposed) return;
    this.retainCount += 1;
  }

  release(): void {
    if (this.disposed) return;
    if (this.retainCount > 0) {
      this.retainCount -= 1;
    }
  }

  markDisposed(): void {
    this.disposed = true;
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  markDeleting(): void {
    this.deleting = true;
  }

  isDeleting(): boolean {
    return this.deleting;
  }

  hasReferences(): boolean {
    return this.retainCount > 0 || this.handleCount > 0;
  }
}

export class ResourceHandle {
  private readonly core: ResourceHandleCore;
  private readonly registry: ResourceHandleRegistry;
  private active = true;

  /** @internal */
  constructor(core: ResourceHandleCore, registry: ResourceHandleRegistry) {
    this.core = core;
    this.registry = registry;
    this.core.attachHandle();
    this.registry.registerHandle(this, core.resourceId);
  }

  get resourceId(): string {
    return this.core.resourceId;
  }

  retain(): this {
    if (!this.active) return this;
    this.core.retain();
    return this;
  }

  release(): void {
    if (!this.active) return;
    this.core.release();
    this.registry.evaluateCleanup(this.core);
  }

  dispose(): void {
    if (!this.active) return;
    this.active = false;
    this.registry.unregisterHandle(this);
    this.core.detachHandle();
    this.registry.evaluateCleanup(this.core);
  }
}

export interface ResourceHandleRegistryConfig {
  deleteResource: DeleteResourceFn;
  logger?: ResourceManagerLogger;
}

export class ResourceHandleRegistry {
  private config: ResourceHandleRegistryConfig | null = null;
  private readonly cores = new Map<string, ResourceHandleCore>();
  private readonly finalizer: FinalizationRegistry<string>;

  constructor() {
    this.finalizer = new FinalizationRegistry(resourceId => {
      const core = this.cores.get(resourceId);
      if (!core) return;
      core.detachHandle();
      this.evaluateCleanup(core);
    });
  }

  configure(config: ResourceHandleRegistryConfig): void {
    this.config = {
      deleteResource: config.deleteResource,
      logger: config.logger ?? DEFAULT_LOGGER,
    };
  }

  track(resourceId: string | null | undefined): ResourceHandle | null {
    if (!resourceId || !isManagedResourceId(resourceId)) {
      return null;
    }
    const core = this.ensureCore(resourceId);
    return new ResourceHandle(core, this);
  }

  acquire(resourceId: string | null | undefined): ResourceHandle | null {
    if (!resourceId || !isManagedResourceId(resourceId)) {
      return null;
    }
    const core = this.cores.get(resourceId);
    if (!core) {
      return null;
    }
    return new ResourceHandle(core, this);
  }

  release(resourceId: string | null | undefined): void {
    if (!resourceId) return;
    const core = this.cores.get(resourceId);
    if (!core) return;
    core.release();
    this.evaluateCleanup(core);
  }

  dispose(resourceId: string | null | undefined): void {
    if (!resourceId) return;
    const core = this.cores.get(resourceId);
    if (!core) return;
    core.markDisposed();
    this.performDelete(core).catch(() => undefined);
  }

  /** @internal */
  registerHandle(handle: ResourceHandle, resourceId: string): void {
    this.finalizer.register(handle, resourceId, handle);
  }

  /** @internal */
  unregisterHandle(handle: ResourceHandle): void {
    this.finalizer.unregister(handle);
  }

  /** @internal */
  evaluateCleanup(core: ResourceHandleCore): void {
    if (core.isDisposed() || core.isDeleting()) {
      return;
    }
    if (core.hasReferences()) {
      return;
    }
    core.markDisposed();
    void this.performDelete(core);
  }

  private ensureCore(resourceId: string): ResourceHandleCore {
    let core = this.cores.get(resourceId);
    if (!core) {
      core = new ResourceHandleCore(resourceId);
      this.cores.set(resourceId, core);
    }
    return core;
  }

  private async performDelete(core: ResourceHandleCore): Promise<void> {
    if (core.isDeleting()) return;
    core.markDeleting();
    this.cores.delete(core.resourceId);
    const deleteFn = this.config?.deleteResource;
    if (!deleteFn) {
      this.config?.logger?.(
        'resource.delete.missing_handler',
        JSON.stringify({ resource: core.resourceId }),
      );
      return;
    }
    try {
      await deleteFn(core.resourceId);
      this.config?.logger?.(
        'resource.delete.success',
        JSON.stringify({ resource: core.resourceId }),
      );
    } catch (error) {
      this.config?.logger?.(
        'resource.delete.error',
        JSON.stringify({
          resource: core.resourceId,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}

export const sidewebResourceHandleRegistry = new ResourceHandleRegistry();

export const isSidewebManagedResourceId = isManagedResourceId;
