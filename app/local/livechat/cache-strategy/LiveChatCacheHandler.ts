import {IPersistence, IPersistenceRead} from '@rocket.chat/apps-engine/definition/accessors';
import {RocketChatAssociationModel, RocketChatAssociationRecord} from '@rocket.chat/apps-engine/definition/metadata';
import ILiveChatCacheDataSource from '../../../data/livechat/cache-strategy/ILiveChatCacheDataSource';
import Department from '../../../domain/Department';

export default class LiveChatCacheHandler implements ILiveChatCacheDataSource {

    private static readonly ASSOC_DEPARTMENTS = new RocketChatAssociationRecord(
        RocketChatAssociationModel.MISC,
        'livechat_departments',
    );

    constructor(
        private readonly reader: IPersistenceRead,
        private readonly writer: IPersistence,
    ) {
    }

    // TODO: invalidate cache
    public async getDepartments(): Promise<Array<Department>> {
        const objects = await this.reader.readByAssociation(LiveChatCacheHandler.ASSOC_DEPARTMENTS);
        return objects.map((o) => o as Department);
    }

    public async saveDepartments(departments: Array<Department>): Promise<number> {
        await this.writer.removeByAssociation(LiveChatCacheHandler.ASSOC_DEPARTMENTS);
        departments.map(async (d) => {
            await this.writer.createWithAssociation(d, LiveChatCacheHandler.ASSOC_DEPARTMENTS);
        });
        return Promise.resolve(departments.length);
    }

}