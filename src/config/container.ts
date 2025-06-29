export const TYPES = {
  // Serviços principais
  AIService: Symbol.for('AIService'),
  DatabaseService: Symbol.for('DatabaseService'),
  CacheService: Symbol.for('CacheService'),
  CommandCatalogService: Symbol.for('CommandCatalogService'),
  FunctionToolsService: Symbol.for('FunctionToolsService'),
  PersonalityService: Symbol.for('PersonalityService'),
  OnboardingService: Symbol.for('OnboardingService'),
  GameService: Symbol.for('GameService'),
  GroupService: Symbol.for('GroupService'),
  OwnerService: Symbol.for('OwnerService'),
  BioExtractorService: Symbol.for('BioExtractorService'),
  
  // NOVO: Sistema de captura de visualização única
  ViewOnceCaptureService: Symbol.for('ViewOnceCaptureService'),
  
  // Novos serviços de persistência
  LocalHistoryService: Symbol.for('LocalHistoryService'),
  DailySummaryService: Symbol.for('DailySummaryService'),
  SchedulerService: Symbol.for('SchedulerService'),
  
  // NOVO: Sistema de alertas e monitoramento
  PerformanceMonitor: Symbol.for('PerformanceMonitor'),
  AlertService: Symbol.for('AlertService'),
  HealthChecker: Symbol.for('HealthChecker'),
  
  // NOVO: Sistema de hooks e plugins
  HookManager: Symbol.for('HookManager'),
  PluginManager: Symbol.for('PluginManager'),
  
  // Core
  Bot: Symbol.for('Bot'),
  MessageManager: Symbol.for('MessageManager'),
  CommandHandler: Symbol.for('CommandHandler'),
  
  // Comandos
  IInjectableCommand: Symbol.for('IInjectableCommand'),
}; 