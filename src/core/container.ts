import { Container } from 'inversify';
import { AIService } from '@/services/AIService';
import { DatabaseService } from '@/services/DatabaseService';
import { CacheService } from '@/services/CacheService';
import { CommandCatalogService } from '@/services/CommandCatalogService';
import { FunctionToolsService } from '@/services/FunctionToolsService';
import { PersonalityService } from '@/services/PersonalityService';
import { OnboardingService } from '@/services/OnboardingService';
import { GameService } from '@/services/GameService';
import { GroupService } from '@/services/GroupService';
import { BioExtractorService } from '@/services/BioExtractorService';
import { LocalHistoryService } from '@/services/LocalHistoryService';
import { DailySummaryService } from '@/services/DailySummaryService';
import { SchedulerService } from '@/services/SchedulerService';
import { MessageManager } from '@/core/MessageManager';
import { Bot } from '@/core/Bot';
import { FofocaCommand } from '@/commands/ai/fofoca';
import { IntrigaCommand } from '@/commands/ai/intriga';
import { PersonalidadeCommand } from '@/commands/admin/personalidade';
import { ResumoCommand } from '@/commands/utils/resumo';
import { BoasvindasCommand } from '@/commands/admin/boasvindas';
import { ComandosCommand } from '@/commands/admin/comandos';
import { ErrosCommand } from '@/commands/admin/erros';
import { IaCommand } from '@/commands/admin/ia';
import { FeedbackCommand } from '@/commands/user/feedback';
import { BrincadeiraCommand } from '@/commands/admin/brincadeira';
import { IInjectableCommand } from '@/interfaces/ICommand';
import BanirCommand from '@/commands/admin/banir';
import PromoverCommand from '@/commands/admin/promover';
import RebaixarCommand from '@/commands/admin/rebaixar';
import RemoverCommand from '@/commands/admin/remover';
import SilenciarCommand from '@/commands/admin/silenciar';
import LiberarCommand from '@/commands/admin/liberar';
import DesbanirCommand from '@/commands/admin/desbanir';
import AdminsCommand from '@/commands/admin/admins';
import ApagarCommand from '@/commands/admin/apagar';
import PersonCommand from '@/commands/admin/person';
import TopativosCommand from '@/commands/admin/topativos';
import InativosCommand from '@/commands/admin/inativos';
import NovatosCommand from '@/commands/admin/novatos';
import CacheCommand from '@/commands/admin/cache';
import LogsCommand from '@/commands/admin/logs';
import { OwnerService } from '@/services/OwnerService';
import { DonoCommand } from '@/commands/owner/dono';
import { UsuariosCommand } from '@/commands/owner/usuarios';
import { SyncCommand } from '@/commands/owner/sync';
import { GrupoCommand } from '@/commands/admin/grupo';
import { BackupCommand } from '@/commands/owner/backup';
import { HistoricoCommand } from '@/commands/admin/historico';
import { TYPES } from '@/config/container';
import { CommandHandler } from '@/core/CommandHandler';
import { TodosCommand } from '@/commands/admin/todos';

// NOVO: Importar novos serviços
import { AlertService } from '@/services/AlertService';
import { PerformanceMonitor } from '@/services/PerformanceMonitor';
import { HookManager } from '@/services/HookManager';
import { PluginManager } from '@/services/PluginManager';
import { ViewOnceCaptureService } from '@/core/ViewOnceCaptureService';

// NOVO: Importar novos comandos
import { AlertasCommand } from '@/commands/owner/alertas';
import { PerformanceCommand } from '@/commands/owner/performance';
import { PluginsCommand } from '@/commands/owner/plugins';

const container = new Container();

// Registra serviços como singletons
container.bind<AIService>(TYPES.AIService).to(AIService).inSingletonScope();
container.bind<DatabaseService>(TYPES.DatabaseService).to(DatabaseService).inSingletonScope();
container.bind<CacheService>(TYPES.CacheService).to(CacheService).inSingletonScope();
container.bind<CommandCatalogService>(TYPES.CommandCatalogService).to(CommandCatalogService).inSingletonScope();
container.bind<FunctionToolsService>(TYPES.FunctionToolsService).to(FunctionToolsService).inSingletonScope();
container.bind<PersonalityService>(TYPES.PersonalityService).to(PersonalityService).inSingletonScope();
container.bind<OnboardingService>(TYPES.OnboardingService).to(OnboardingService).inSingletonScope();
container.bind<GameService>(TYPES.GameService).to(GameService).inSingletonScope();
container.bind<GroupService>(TYPES.GroupService).to(GroupService).inSingletonScope();
container.bind<BioExtractorService>(TYPES.BioExtractorService).to(BioExtractorService).inSingletonScope();
container.bind<LocalHistoryService>(TYPES.LocalHistoryService).to(LocalHistoryService).inSingletonScope();
container.bind<DailySummaryService>(TYPES.DailySummaryService).to(DailySummaryService).inSingletonScope();
container.bind<SchedulerService>(TYPES.SchedulerService).to(SchedulerService).inSingletonScope();
container.bind<CommandHandler>(TYPES.CommandHandler).to(CommandHandler).inSingletonScope();
container.bind<MessageManager>(TYPES.MessageManager).to(MessageManager).inSingletonScope();
container.bind<Bot>(TYPES.Bot).to(Bot).inSingletonScope();
container.bind<OwnerService>(TYPES.OwnerService).to(OwnerService).inSingletonScope();

// NOVO: Registrar novos serviços
container.bind<AlertService>(TYPES.AlertService).to(AlertService).inSingletonScope();
container.bind<PerformanceMonitor>(TYPES.PerformanceMonitor).to(PerformanceMonitor).inSingletonScope();
container.bind<HookManager>(TYPES.HookManager).to(HookManager).inSingletonScope();
container.bind<PluginManager>(TYPES.PluginManager).to(PluginManager).inSingletonScope();
container.bind<ViewOnceCaptureService>(TYPES.ViewOnceCaptureService).to(ViewOnceCaptureService).inSingletonScope();

// Registra comandos injetáveis (apenas classes com @injectable)
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(FofocaCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(IntrigaCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(PersonalidadeCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(ResumoCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(BoasvindasCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(ComandosCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(ErrosCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(IaCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(FeedbackCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(BrincadeiraCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(DonoCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(UsuariosCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(SyncCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(GrupoCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(BackupCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(HistoricoCommand);

// NOVO: Registrar novos comandos
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(AlertasCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(PerformanceCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(PluginsCommand);
container.bind<IInjectableCommand>(TYPES.IInjectableCommand).to(TodosCommand);

export { container }; 