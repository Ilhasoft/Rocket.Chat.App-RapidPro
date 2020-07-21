import {HttpStatusCode, IHttp, IModify, IPersistence, IRead} from '@rocket.chat/apps-engine/definition/accessors';
import {ApiEndpoint, IApiEndpointInfo, IApiRequest} from '@rocket.chat/apps-engine/definition/api';
import {IApiResponseJSON} from '@rocket.chat/apps-engine/definition/api/IResponse';
import { IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import LiveChatCacheStrategyRepositoryImpl from '../../data/livechat/cache-strategy/LiveChatCacheStrategyRepositoryImpl';
import AppError from '../../domain/AppError';
import LiveChatCacheHandler from '../../local/livechat/cache-strategy/LiveChatCacheHandler';
import LiveChatInternalHandler from '../../local/livechat/cache-strategy/LiveChatInternalHandler';
import ILiveChatCredentials from '../../remote/livechat/cache-strategy/ILiveChatCredentials';
import LiveChatRestApi from '../../remote/livechat/cache-strategy/LiveChatRestApi';
import { RC_ACCESS_TOKEN, RC_SERVER_URL, RC_USER_ID, REQUEST_TIMEOUT } from '../../settings/Constants';
import validateRequest from './ValidateCreateRoomRequest';

export class CreateRoomEndpoint extends ApiEndpoint {
    public path = 'room';

    public async get(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<IApiResponseJSON> {

        // Query parameters verification
        const errors = validateRequest(request.content);
        if (errors) {
            const errorMessage = `Invalid body parameters...: ${JSON.stringify(errors)}`;
            this.app.getLogger().error(errorMessage);
            return this.json({status: HttpStatusCode.BAD_REQUEST, content: {error: errorMessage}});
        }

        // Constants initialization
        const baseUrl: string = await read.getEnvironmentReader().getServerSettings().getValueById(RC_SERVER_URL);
        const timeout: number = await read.getEnvironmentReader().getSettings().getValueById(REQUEST_TIMEOUT);
        const credentials: ILiveChatCredentials = {
            authToken: await read.getEnvironmentReader().getSettings().getValueById(RC_ACCESS_TOKEN),
            userId: await read.getEnvironmentReader().getSettings().getValueById(RC_USER_ID),
        };

        // livechatRepo initialization
        const livechatRepo = new LiveChatCacheStrategyRepositoryImpl(
            new LiveChatCacheHandler(read.getPersistenceReader(), persis),
            new LiveChatRestApi(http, baseUrl, credentials, timeout),
            new LiveChatInternalHandler(modify, read.getLivechatReader()),
        );

        // Execute visitor and room creation
        try {
            const visitor = request.content.visitor as IVisitor;
            visitor.username = visitor.name;
            const createdVisitor = await livechatRepo.createVisitor(visitor);
            const room = await livechatRepo.createRoom(
                request.content.ticketId,
                request.content.visitor.contactUuid,
                createdVisitor.visitor,
            );
            return this.json({status: HttpStatusCode.CREATED, content: {id: room.id}});
        } catch (e) {
            this.app.getLogger().error(e);
            if (e.constructor.name === AppError.name) {
                return this.json({status: e.statusCode, content: {error: e.message}});
            }

            return this.json({status: HttpStatusCode.INTERNAL_SERVER_ERROR, content: {error: 'Unexpected error'}});
        }

    }

}
