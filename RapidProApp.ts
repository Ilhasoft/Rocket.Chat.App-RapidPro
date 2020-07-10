import {
    IAppAccessors,
    IConfigurationExtend,
    IEnvironmentRead,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import {ApiSecurity, ApiVisibility, IApi} from '@rocket.chat/apps-engine/definition/api';
import {App} from '@rocket.chat/apps-engine/definition/App';
import {ILivechatRoom, ILivechatRoomClosedHandler, IVisitor} from '@rocket.chat/apps-engine/definition/livechat';
import {IAppInfo} from '@rocket.chat/apps-engine/definition/metadata';
import LiveChatCacheStrategyRepositoryImpl from './app/data/livechat/cache-strategy/LiveChatCacheStrategyRepositoryImpl';
import { CheckSecretEndpoint } from './app/endpoint/check-secret/CheckSecretEndpoint';
import {CreateRoomEndpoint} from './app/endpoint/create-room/CreateRoomEndpoint';
import { SetCallbackEndpoint } from './app/endpoint/set-callback/SetCallbackEndpoint';
import { VisitorMesssageEndpoint } from './app/endpoint/visitor-message/VisitorMessageEndpoint';
import LiveChatCacheHandler from './app/local/livechat/cache-strategy/LiveChatCacheHandler';
import LiveChatInternalHandler from './app/local/livechat/cache-strategy/LiveChatInternalHandler';
import ILiveChatCredentials from './app/remote/livechat/cache-strategy/ILiveChatCredentials';
import LiveChatRestApi from './app/remote/livechat/cache-strategy/LiveChatRestApi';
import RapidProRestApi from './app/remote/rapidpro/RapidProRestApi';
import {AppSettings} from './app/settings/AppSettings';
import { PUSH_BASE_URL, PUSH_CLOSED_FLOW, PUSH_TOKEN, REQUEST_TIMEOUT } from './app/settings/Constants';

export class RapidProApp extends App implements ILivechatRoomClosedHandler {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async initialize(configurationExtend: IConfigurationExtend, environmentRead: IEnvironmentRead): Promise<void> {
        await this.extendConfiguration(configurationExtend);
        await configurationExtend.api.provideApi({
            visibility: ApiVisibility.PUBLIC,
            security: ApiSecurity.UNSECURE,
            endpoints: [
                new CreateRoomEndpoint(this),
                new VisitorMesssageEndpoint(this),
                new SetCallbackEndpoint(this),
                new CheckSecretEndpoint(this),
            ],
        } as IApi);
        this.getLogger().log('RapidPro App Initialized');
    }

    public async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        AppSettings.forEach((setting) => configuration.settings.provideSetting(setting));
    }

    // TODO: executePostLivechatRoomClosed is being executed twice, check why (bug?) and change to that in the future
    public async executeLivechatRoomClosedHandler(data: ILivechatRoom, read: IRead, http: IHttp, persistence: IPersistence) {
        const visitor: IVisitor = (data.visitor as any) as IVisitor;

        const livechatRepo = new LiveChatCacheStrategyRepositoryImpl(
            new LiveChatCacheHandler(read.getPersistenceReader(), persistence),
            new LiveChatRestApi(http, '', {} as ILiveChatCredentials, 0),
            new LiveChatInternalHandler({} as IModify),
        );

        const room = await livechatRepo.getRoomByVisitorToken(visitor.token);
        if (!room) {
            const errorMessage = `Could not find room for visitor with token: ${visitor.token}`;
            this.getLogger().error(errorMessage);
        }
        await livechatRepo.closeRoom(room!);

        const baseUrl = await read.getEnvironmentReader().getSettings().getValueById(PUSH_BASE_URL);
        const authToken = await read.getEnvironmentReader().getSettings().getValueById(PUSH_TOKEN);
        const timeout = await read.getEnvironmentReader().getSettings().getValueById(REQUEST_TIMEOUT);
        const rapidpro = new RapidProRestApi(http, baseUrl, authToken, timeout);

        const closeTicket = await read.getEnvironmentReader().getSettings().getValueById(PUSH_CLOSED_FLOW);
        const extra = {
            agent: data.servedBy,
            livechat: data,
        };
        // TODO: change to ticket implementation later
        await rapidpro.startFlow(closeTicket, visitor, extra);
        // TODO: broadcast agent message on room close
    }

}
