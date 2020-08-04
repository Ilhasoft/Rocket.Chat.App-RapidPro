import {HttpStatusCode, IHttp, IModify, IPersistence, IRead} from '@rocket.chat/apps-engine/definition/accessors';
import {ApiEndpoint, IApiEndpointInfo, IApiRequest} from '@rocket.chat/apps-engine/definition/api';
import {IApiResponseJSON} from '@rocket.chat/apps-engine/definition/api/IResponse';

import ILiveChatRepository from '../data/livechat/ILiveChatRepository';
import LiveChatRepositoryImpl from '../data/livechat/LiveChatRepositoryImpl';
import AppError from '../domain/AppError';
import LiveChatAppsEngine from '../local/livechat/LiveChatAppsEngine';
import LiveChatPersistence from '../local/livechat/LiveChatPersistence';
import RequestBodyValidator from '../utils/RequestBodyValidator';
import RequestHeadersValidator from '../utils/RequestHeadersValidator';

export class CloseRoomEndpoint extends ApiEndpoint {

    public path = 'room.close';

    private bodyConstraints = {
        'visitor': {
            presence: {
                allowEmpty: false,
            },
        },
        'visitor.token': {
            presence: {
                allowEmpty: false,
            },
            type: 'string',
        },
        'comment': {
            presence: {
                allowEmpty: false,
            },
            type: 'string',
        },
    };

    public async get(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<IApiResponseJSON> {
        try {
            await RequestHeadersValidator.validate(read, request.headers);
            await RequestBodyValidator.validate(this.bodyConstraints, request.content);

            const livechatRepo: ILiveChatRepository = new LiveChatRepositoryImpl(
                new LiveChatPersistence(read.getPersistenceReader(), persis),
                new LiveChatAppsEngine(modify, read.getLivechatReader()),
            );
            await livechatRepo.endpointCloseRoom(request.content.visitor.token, request.content.comment);
            return this.success();
        } catch (e) {
            this.app.getLogger().error(e);

            if (e.constructor.name === AppError.name) {
                return this.json({status: e.statusCode, content: {error: e.message}});
            }
            return this.json({status: HttpStatusCode.INTERNAL_SERVER_ERROR, content: {error: 'Unexpected error'}});
        }
    }

}
